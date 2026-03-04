import { FastifyInstance, FastifyRequest } from "fastify";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import {
  createRoom,
  updateRoom,
  deleteRoom,
  adminStartNow,
  getAllRooms,
  lockRoom,
} from "../services/room.service";
import { deleteMessage, muteUser } from "../services/chat.service";
import { generateCardImage, generateResultImage, getGreetingsList, GREETINGS_FILE } from "../services/image.service";
import prisma from "../lib/prisma";
import { getCurrentEventRound } from "../lib/event-round";
import { getIo } from "../websocket";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

interface PrizeTierConfig {
  tier: string;
  label: string;
  value: number;
  count: number;
  color: string;
}

const DEFAULT_PRIZE_CONFIG: PrizeTierConfig[] = [
  { tier: "FIRST", label: "Giải Nhất — 2.500.000đ", value: 2500000, count: 1, color: "#D4AF37" },
  { tier: "SECOND", label: "Giải Nhì — 1.000.000đ", value: 1000000, count: 10, color: "#C9B8A8" },
  { tier: "THIRD", label: "Giải Ba — 500.000đ", value: 500000, count: 20, color: "#B87D6B" },
  { tier: "CONS", label: "Giải KK — 210.000đ", value: 210000, count: 369, color: "#D4708F" },
];

async function getPrizeConfig(): Promise<PrizeTierConfig[]> {
  const cfg = await prisma.eventConfig.findUnique({ where: { key: "prize_config" } });
  if (!cfg) return DEFAULT_PRIZE_CONFIG;
  try { return JSON.parse(cfg.value); } catch { return DEFAULT_PRIZE_CONFIG; }
}

/** Parse DD/MM/YYYY, DDMMYYYY, YYYY-MM-DD → Date | null */
function parseDob(input: string): Date | null {
  const s = input.trim().replace(/\s/g, "");
  let d: string, m: string, y: string;
  if (s.includes("/")) {
    [d, m, y] = s.split("/");
  } else if (s.includes("-")) {
    [y, m, d] = s.split("-");
  } else if (s.length === 8) {
    d = s.slice(0, 2); m = s.slice(2, 4); y = s.slice(4, 8);
  } else {
    return null;
  }
  const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  return isNaN(date.getTime()) ? null : date;
}

export async function adminRoutes(app: FastifyInstance) {
  // POST /api/v1/admin/rooms
  app.post("/rooms", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const adminId = (req.user as { id: string }).id;
    const { name } = (req.body as { name?: string }) || {};
    const roomId = await createRoom(adminId, name);
    const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.code(201).send({
      room: {
        id: roomId,
        name: name || null,
        status: "CREATED",
        qrUrl: `${BASE}/join?room=${roomId}`,
      },
    });
  });

  // GET /api/v1/admin/rooms
  app.get("/rooms", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const rooms = await getAllRooms();
    return reply.send({
      rooms: rooms.map((r) => ({
        id: r.id,
        name: (r as any).name || null,
        status: r.status,
        participantCount: (r as any)._count.participants,
        createdAt: r.createdAt.toISOString(),
        waitingSecondsElapsed: r.waitingStartedAt
          ? Math.floor((Date.now() - r.waitingStartedAt.getTime()) / 1000)
          : null,
      })),
      total: rooms.length,
    });
  });

  // PUT /api/v1/admin/rooms/:roomId — rename
  app.put("/rooms/:roomId", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const { name } = req.body as { name: string };
    const result = await updateRoom(req.params.roomId, name);
    if ("error" in result) return reply.code(result.code).send({ success: false, error: result.error });
    return reply.send({ success: true });
  });

  // DELETE /api/v1/admin/rooms/:roomId
  app.delete("/rooms/:roomId", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const result = await deleteRoom(req.params.roomId);
    if ("error" in result) return reply.code(result.code).send({ success: false, error: result.error });
    return reply.send({ success: true });
  });

  // POST /api/v1/admin/rooms/:roomId/start-now
  app.post("/rooms/:roomId/start-now", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const adminId = (req.user as { id: string }).id;
    const result = await adminStartNow(adminId, req.params.roomId);
    if (result && "error" in result) {
      return reply.code(result.code ?? 400).send({ success: false, error: result.error });
    }
    return reply.send({ success: true, message: "Phòng đang đếm ngược 30s" });
  });

  // POST /api/v1/admin/rooms/:roomId/lock
  app.post("/rooms/:roomId/lock", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    await lockRoom(req.params.roomId, "ADMIN_TRIGGERED");
    return reply.send({ success: true });
  });

  // GET /api/v1/admin/stats
  app.get("/stats", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const eventRound = await getCurrentEventRound();
    const tierConfig = await getPrizeConfig();
    const tierConfigMap = new Map(tierConfig.map((t) => [t.tier, t]));

    const [total, spun, prizeStats, assignedStats, eventCfg] = await Promise.all([
      prisma.employee.count({ where: { role: "user" } }),
      prisma.employee.count({ where: { hasSpun: true } }),
      prisma.prize.groupBy({ by: ["tier"], _count: { id: true }, where: { eventRound } }),
      prisma.prize.groupBy({ by: ["tier"], _count: { id: true }, where: { assigned: true, eventRound } }),
      prisma.eventConfig.findUnique({ where: { key: "event_status" } }),
    ]);

    const prizePool: Record<string, { total: number; assigned: number; remaining: number; label: string; color: string }> = {};
    for (const ps of prizeStats) {
      const a = assignedStats.find((p) => p.tier === ps.tier)?._count.id || 0;
      const cfg = tierConfigMap.get(ps.tier);
      prizePool[ps.tier] = {
        total: ps._count.id,
        assigned: a,
        remaining: ps._count.id - a,
        label: cfg?.label || ps.tier,
        color: cfg?.color || "#D4708F",
      };
    }

    return reply.send({
      totalParticipants: total,
      spunCount: spun,
      remainingCount: total - spun,
      eventStatus: eventCfg?.value || "PENDING",
      eventRound,
      prizePool,
    });
  });

  // PUT /api/v1/admin/event/name
  app.put("/event/name", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const { name } = req.body as { name: string };
    await prisma.eventConfig.upsert({
      where: { key: "event_name" },
      update: { value: name || "WomanDay Spin 8/3" },
      create: { key: "event_name", value: name || "WomanDay Spin 8/3" },
    });
    return reply.send({ success: true });
  });

  // POST /api/v1/admin/event/start
  app.post("/event/start", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    await prisma.eventConfig.upsert({
      where: { key: "event_status" },
      update: { value: "RUNNING" },
      create: { key: "event_status", value: "RUNNING" },
    });
    return reply.send({ success: true, eventStatus: "RUNNING" });
  });

  // POST /api/v1/admin/event/stop
  app.post("/event/stop", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    await prisma.eventConfig.upsert({
      where: { key: "event_status" },
      update: { value: "STOPPED" },
      create: { key: "event_status", value: "STOPPED" },
    });
    return reply.send({ success: true, eventStatus: "STOPPED" });
  });

  // POST /api/v1/admin/event/reset — reset event for new round
  app.post("/event/reset", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const currentRound = await getCurrentEventRound();
    const newRound = currentRound + 1;

    // 1. Update event_round + reset event_status
    await prisma.eventConfig.upsert({
      where: { key: "event_round" },
      update: { value: String(newRound) },
      create: { key: "event_round", value: String(newRound) },
    });
    await prisma.eventConfig.upsert({
      where: { key: "event_status" },
      update: { value: "PENDING" },
      create: { key: "event_status", value: "PENDING" },
    });

    // 2. Reset all employees: hasSpun = false, resultImageUrl = null
    //    (keep selfieUrl + cardImageUrl — no need to retake selfie/card)
    await prisma.employee.updateMany({
      where: { role: "user" },
      data: { hasSpun: false, resultImageUrl: null },
    });

    // 3. Mark all non-DONE rooms as DONE (cleanup stale rooms)
    await prisma.room.updateMany({
      where: { status: { notIn: ["DONE"] } },
      data: { status: "DONE", doneAt: new Date() },
    });

    // 4. Create new prize pool for the new round (from prize config)
    const tierConfig = await getPrizeConfig();
    const prizes: { tier: string; label: string; value: number; eventRound: number }[] = [];
    for (const tc of tierConfig) {
      for (let i = 0; i < tc.count; i++) {
        prizes.push({ tier: tc.tier, label: tc.label, value: tc.value, eventRound: newRound });
      }
    }
    prizes.sort(() => Math.random() - 0.5);
    await prisma.prize.createMany({ data: prizes });

    console.log(`[ResetEvent] Round ${currentRound} → ${newRound}. Created ${prizes.length} new prizes.`);

    return reply.send({
      success: true,
      newRound,
      message: `Sự kiện đã reset! Bắt đầu lần #${newRound}. Đã tạo ${prizes.length} giải thưởng mới.`,
    });
  });

  // GET /api/v1/admin/event/history — event history by round
  app.get("/event/history", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const currentRound = await getCurrentEventRound();

    // Get spin stats grouped by eventRound
    const roundStats = await prisma.spinLog.groupBy({
      by: ["eventRound"],
      _count: { id: true },
      _min: { spunAt: true },
      _max: { spunAt: true },
      orderBy: { eventRound: "desc" },
    });

    // Get prize breakdown per round
    const rounds = await Promise.all(
      roundStats.map(async (rs) => {
        const prizeBreakdown = await prisma.spinLog.groupBy({
          by: ["tier"],
          _count: { id: true },
          _sum: { value: true },
          where: { eventRound: rs.eventRound },
        });

        return {
          round: rs.eventRound,
          isCurrent: rs.eventRound === currentRound,
          totalSpun: rs._count.id,
          startedAt: rs._min.spunAt?.toISOString() || null,
          endedAt: rs._max.spunAt?.toISOString() || null,
          prizeBreakdown: prizeBreakdown.map((p) => ({
            tier: p.tier,
            count: p._count.id,
            totalValue: p._sum.value || 0,
          })),
        };
      })
    );

    // Include current round even if no spins yet
    if (!rounds.find((r) => r.round === currentRound)) {
      rounds.unshift({
        round: currentRound,
        isCurrent: true,
        totalSpun: 0,
        startedAt: null,
        endedAt: null,
        prizeBreakdown: [],
      });
    }

    return reply.send({ currentRound, rounds });
  });

  // GET /api/v1/admin/prize-config — get current prize tier config
  app.get("/prize-config", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const config = await getPrizeConfig();
    const total = config.reduce((sum, t) => sum + t.count, 0);
    const totalValue = config.reduce((sum, t) => sum + t.value * t.count, 0);
    return reply.send({ tiers: config, totalPrizes: total, totalValue });
  });

  // PUT /api/v1/admin/prize-config — save prize tier config
  app.put("/prize-config", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest, reply) => {
    const { tiers } = req.body as { tiers: PrizeTierConfig[] };
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return reply.code(400).send({ success: false, error: "EMPTY_CONFIG", message: "Cần ít nhất 1 hạng giải" });
    }
    for (const t of tiers) {
      if (!t.tier || !t.label || t.count < 1) {
        return reply.code(400).send({ success: false, error: "INVALID_TIER", message: `Hạng "${t.tier || '?'}" không hợp lệ` });
      }
    }
    await prisma.eventConfig.upsert({
      where: { key: "prize_config" },
      update: { value: JSON.stringify(tiers) },
      create: { key: "prize_config", value: JSON.stringify(tiers) },
    });
    const total = tiers.reduce((sum, t) => sum + t.count, 0);
    return reply.send({ success: true, totalPrizes: total, message: `Đã lưu cấu hình ${tiers.length} hạng, tổng ${total} giải` });
  });

  // GET /api/v1/admin/export/results  — CSV download (?round=X)
  app.get("/export/results", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Querystring: { round?: string } }>, reply) => {
    const roundParam = (req.query as any).round;
    const round = roundParam ? parseInt(roundParam, 10) : await getCurrentEventRound();

    const logs = await prisma.spinLog.findMany({
      where: { eventRound: round },
      include: { user: { select: { cccd: true, name: true, dept: true, position: true } } },
      orderBy: { spunAt: "asc" },
    });

    const rows = logs.map((l) => [
      l.user.cccd,
      l.user.name,
      l.user.dept,
      l.user.position,
      l.tier,
      l.value.toString(),
      l.roomId,
      l.spunAt.toISOString(),
    ]);

    const BOM = "\uFEFF";
    const header = "cccd,name,dept,position,tier,value,room_id,spun_at";
    const csv = BOM + header + "\n" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="results_round${round}_${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  // DELETE /api/v1/admin/chat/:messageId
  app.delete("/chat/:messageId", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { messageId: string } }>, reply) => {
    const adminId = (req.user as { id: string }).id;
    await deleteMessage(req.params.messageId, adminId);
    return reply.send({ success: true, messageId: req.params.messageId, action: "deleted" });
  });

  // POST /api/v1/admin/chat/mute/:userId
  app.post("/chat/mute/:userId", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { userId: string }; Body: { duration_minutes?: number } }>, reply) => {
    const duration = (req.body as any)?.duration_minutes || 10;
    const updated = await muteUser(req.params.userId, duration);
    return reply.send({ success: true, userId: req.params.userId, mutedUntil: updated.mutedUntil?.toISOString() });
  });

  // ── Employee Management ──────────────────────────────────────

  // GET /api/v1/admin/employees — with search, filter, pagination
  app.get("/employees", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const { q, dept, page, limit } = req.query as { q?: string; dept?: string; page?: string; limit?: string };
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit || "50", 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { cccd: { contains: q } },
      ];
    }
    if (dept) {
      where.dept = dept;
    }

    const [employees, total, deptRows] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: {
          id: true, cccd: true, name: true, dept: true, position: true,
          dob: true, role: true, hasSpun: true, selfieUrl: true,
          cardImageUrl: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limitNum,
      }),
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        select: { dept: true },
        distinct: ["dept"],
        orderBy: { dept: "asc" },
      }),
    ]);

    return reply.send({
      employees,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      departments: deptRows.map((r) => r.dept),
    });
  });

  // POST /api/v1/admin/employees — create employee
  app.post("/employees", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const { cccd, dob, name, position, dept, role } = req.body as {
      cccd: string; dob: string; name: string; position?: string; dept?: string; role?: string;
    };
    if (!cccd || !dob || !name) {
      return reply.code(400).send({ success: false, error: "MISSING_FIELDS", message: "CCCD, ngày sinh và họ tên là bắt buộc" });
    }
    const dobDate = parseDob(dob);
    if (!dobDate) {
      return reply.code(400).send({ success: false, error: "INVALID_DOB", message: "Ngày sinh không hợp lệ (DD/MM/YYYY)" });
    }
    const existing = await prisma.employee.findUnique({ where: { cccd } });
    if (existing) {
      return reply.code(409).send({ success: false, error: "DUPLICATE_CCCD", message: `CCCD ${cccd} đã tồn tại` });
    }
    const emp = await prisma.employee.create({
      data: { cccd, dob: dobDate, name, position: position || "", dept: dept || "", role: role || "user" },
    });
    return reply.code(201).send({ success: true, employee: emp });
  });

  // POST /api/v1/admin/employees/reset-all — MUST be before :id routes
  app.post("/employees/reset-all", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const eventRound = await getCurrentEventRound();
    await prisma.$transaction(async (tx) => {
      // Delete spin logs first (FK references Prize)
      await tx.spinLog.deleteMany({ where: { eventRound } });
      // Unassign prizes for current round
      await tx.prize.updateMany({
        where: { eventRound, assigned: true },
        data: { assigned: false, assignedTo: null, assignedAt: null },
      });
      // Delete room participants for non-DONE rooms
      const activeRooms = await tx.room.findMany({ where: { status: { not: "DONE" } }, select: { id: true } });
      if (activeRooms.length > 0) {
        await tx.roomParticipant.deleteMany({ where: { roomId: { in: activeRooms.map((r) => r.id) } } });
      }
      // Reset all users (not admin)
      await tx.employee.updateMany({
        where: { role: "user" },
        data: { hasSpun: false, selfieUrl: null, cardTemplateId: null, cardImageUrl: null, resultImageUrl: null },
      });
    });
    return reply.send({ success: true, message: "Đã reset tất cả nhân viên" });
  });

  // GET /api/v1/admin/employees/export — export employee list as CSV
  app.get("/employees/export", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const { q, dept } = req.query as { q?: string; dept?: string };
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { cccd: { contains: q } },
      ];
    }
    if (dept) where.dept = dept;

    const employees = await prisma.employee.findMany({
      where,
      select: {
        cccd: true, name: true, dob: true, dept: true, position: true,
        role: true, hasSpun: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    function fmtDate(d: Date): string {
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
    function esc(v: string): string { return `"${v.replace(/"/g, '""')}"`; }

    const BOM = "\uFEFF";
    const header = "CCCD,Ho_ten,Ngay_sinh,Phong_ban,Chuc_vu,Role,Da_quay,Dang_nhap_cuoi,Ngay_tao";
    const rows = employees.map((e) =>
      [e.cccd, e.name, fmtDate(e.dob), e.dept, e.position, e.role,
       e.hasSpun ? "Co" : "Khong",
       e.lastLoginAt ? e.lastLoginAt.toISOString() : "",
       e.createdAt.toISOString(),
      ].map(esc).join(",")
    );

    const csv = BOM + header + "\n" + rows.join("\n");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="nhan_vien_${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  // GET /api/v1/admin/employees/export-full — full report: employees + prizes + quiz
  app.get("/employees/export-full", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const eventRound = await getCurrentEventRound();

    const employees = await prisma.employee.findMany({
      where: { role: "user" },
      select: {
        cccd: true, name: true, dob: true, dept: true, position: true,
        hasSpun: true, lastLoginAt: true,
        spinLogs: {
          where: { eventRound },
          select: { tier: true, value: true, roomId: true, spunAt: true },
          take: 1,
        },
        quizAnswers: {
          select: { isCorrect: true },
        },
      },
      orderBy: { name: "asc" },
    });

    function fmtDate(d: Date): string {
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
    function esc(v: string): string { return `"${v.replace(/"/g, '""')}"`; }

    const TIER_LABELS: Record<string, string> = {
      FIRST: "Giai Nhat", SECOND: "Giai Nhi", THIRD: "Giai Ba", CONS: "Giai KK",
    };

    const BOM = "\uFEFF";
    const header = "CCCD,Ho_ten,Ngay_sinh,Phong_ban,Chuc_vu,Da_quay,Giai_thuong,Gia_tri_VND,Phong_quay,Thoi_gian_quay,Quiz_dung,Quiz_tong,Dang_nhap_cuoi";
    const rows = employees.map((e) => {
      const spin = e.spinLogs[0] || null;
      const quizCorrect = e.quizAnswers.filter((a) => a.isCorrect).length;
      const quizTotal = e.quizAnswers.length;
      return [
        e.cccd, e.name, fmtDate(e.dob), e.dept, e.position,
        e.hasSpun ? "Co" : "Khong",
        spin ? (TIER_LABELS[spin.tier] || spin.tier) : "",
        spin ? String(spin.value) : "",
        spin ? spin.roomId : "",
        spin ? spin.spunAt.toISOString() : "",
        String(quizCorrect), String(quizTotal),
        e.lastLoginAt ? e.lastLoginAt.toISOString() : "",
      ].map(esc).join(",");
    });

    const csv = BOM + header + "\n" + rows.join("\n");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="bao_cao_day_du_round${eventRound}_${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  // PUT /api/v1/admin/employees/:id — update employee
  app.put("/employees/:id", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const body = req.body as { name?: string; position?: string; dept?: string; role?: string; cccd?: string; dob?: string };
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return reply.code(404).send({ success: false, error: "NOT_FOUND", message: "Nhân viên không tồn tại" });

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.position !== undefined) data.position = body.position;
    if (body.dept !== undefined) data.dept = body.dept;
    if (body.role !== undefined) data.role = body.role;
    if (body.cccd !== undefined && body.cccd !== emp.cccd) {
      const conflict = await prisma.employee.findUnique({ where: { cccd: body.cccd } });
      if (conflict) return reply.code(409).send({ success: false, error: "DUPLICATE_CCCD", message: `CCCD ${body.cccd} đã tồn tại` });
      data.cccd = body.cccd;
    }
    if (body.dob !== undefined) {
      const dobDate = parseDob(body.dob);
      if (!dobDate) return reply.code(400).send({ success: false, error: "INVALID_DOB", message: "Ngày sinh không hợp lệ" });
      data.dob = dobDate;
    }

    const updated = await prisma.employee.update({ where: { id }, data });
    return reply.send({ success: true, employee: updated });
  });

  // DELETE /api/v1/admin/employees/:id — cascade delete
  app.delete("/employees/:id", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return reply.code(404).send({ success: false, error: "NOT_FOUND", message: "Nhân viên không tồn tại" });
    if (emp.role === "admin") return reply.code(403).send({ success: false, error: "CANNOT_DELETE_ADMIN", message: "Không thể xóa tài khoản admin" });

    await prisma.$transaction(async (tx) => {
      await tx.quizAnswer.deleteMany({ where: { userId: id } });
      await tx.cardLike.deleteMany({ where: { OR: [{ userId: id }, { targetUserId: id }] } });
      await tx.wish.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
      await tx.chatMessage.deleteMany({ where: { userId: id } });
      await tx.generatedImage.deleteMany({ where: { userId: id } });
      // SpinLog references Prize (FK prizeId), delete SpinLog first
      await tx.spinLog.deleteMany({ where: { userId: id } });
      // Unassign prizes (don't delete, just clear assignedTo)
      await tx.prize.updateMany({ where: { assignedTo: id }, data: { assigned: false, assignedTo: null, assignedAt: null } });
      await tx.roomParticipant.deleteMany({ where: { userId: id } });
      await tx.employee.delete({ where: { id } });
    });

    return reply.send({ success: true, message: `Đã xóa nhân viên ${emp.name}` });
  });

  // POST /api/v1/admin/employees/:id/reset — reset one employee
  app.post("/employees/:id/reset", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return reply.code(404).send({ success: false, error: "NOT_FOUND", message: "Nhân viên không tồn tại" });

    const eventRound = await getCurrentEventRound();
    await prisma.$transaction(async (tx) => {
      // Delete spin log first (FK references Prize)
      await tx.spinLog.deleteMany({ where: { userId: id, eventRound } });
      // Unassign prize for current round
      await tx.prize.updateMany({
        where: { assignedTo: id, eventRound },
        data: { assigned: false, assignedTo: null, assignedAt: null },
      });
      // Remove from non-DONE rooms
      const activeRooms = await tx.room.findMany({ where: { status: { not: "DONE" } }, select: { id: true } });
      if (activeRooms.length > 0) {
        await tx.roomParticipant.deleteMany({ where: { userId: id, roomId: { in: activeRooms.map((r) => r.id) } } });
      }
      // Reset employee fields
      await tx.employee.update({
        where: { id },
        data: { hasSpun: false, selfieUrl: null, cardTemplateId: null, cardImageUrl: null, resultImageUrl: null },
      });
    });

    return reply.send({ success: true, message: `Đã reset nhân viên ${emp.name}` });
  });

  // GET /api/v1/admin/employees/:id/detail — full employee info + spin + quiz
  app.get("/employees/:id/detail", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return reply.code(404).send({ success: false, error: "NOT_FOUND" });

    const eventRound = await getCurrentEventRound();
    const [spinLog, quizAnswers] = await Promise.all([
      prisma.spinLog.findUnique({
        where: { userId_eventRound: { userId: id, eventRound } },
        include: { prize: { select: { label: true } } },
      }),
      prisma.quizAnswer.findMany({
        where: { userId: id },
        select: { questionId: true, selectedIndex: true, isCorrect: true, answeredAt: true },
        orderBy: { questionId: "asc" },
      }),
    ]);

    return reply.send({
      employee: {
        id: emp.id, cccd: emp.cccd, dob: emp.dob, name: emp.name,
        position: emp.position, dept: emp.dept, role: emp.role, hasSpun: emp.hasSpun,
        selfieUrl: emp.selfieUrl, cardImageUrl: emp.cardImageUrl, resultImageUrl: emp.resultImageUrl,
        megaphoneSmall: emp.megaphoneSmall, megaphoneBig: emp.megaphoneBig, flowerBalance: emp.flowerBalance,
        lastLoginAt: emp.lastLoginAt, createdAt: emp.createdAt,
      },
      spinLog: spinLog ? {
        tier: spinLog.tier, value: spinLog.value,
        label: spinLog.prize?.label || spinLog.tier,
        roomId: spinLog.roomId, spunAt: spinLog.spunAt,
      } : null,
      quizAnswers,
      quizTotal: 10,
      quizCorrect: quizAnswers.filter((a) => a.isCorrect).length,
    });
  });

  // POST /api/v1/admin/employees/:id/grant — grant megaphone/flowers
  app.post("/employees/:id/grant", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const { type, amount } = req.body as { type: string; amount: number };
    const validTypes = ["megaphoneSmall", "megaphoneBig", "flowerBalance"];
    if (!validTypes.includes(type)) {
      return reply.code(400).send({ success: false, error: "INVALID_TYPE", message: "Type phải là megaphoneSmall, megaphoneBig hoặc flowerBalance" });
    }
    if (!amount || amount < 1 || amount > 100) {
      return reply.code(400).send({ success: false, error: "INVALID_AMOUNT", message: "Số lượng phải từ 1–100" });
    }
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return reply.code(404).send({ success: false, error: "NOT_FOUND" });

    const updated = await prisma.employee.update({
      where: { id },
      data: { [type]: { increment: amount } },
      select: { megaphoneSmall: true, megaphoneBig: true, flowerBalance: true },
    });

    // Emit real-time balance update to the user via socket
    try {
      const io = getIo();
      io.emit("megaphone_balance_update", {
        userId: id,
        megaphoneSmall: updated.megaphoneSmall,
        megaphoneBig: updated.megaphoneBig,
        flowerBalance: updated.flowerBalance,
      });
    } catch {}

    const labels: Record<string, string> = { megaphoneSmall: "loa nhỏ", megaphoneBig: "loa lớn", flowerBalance: "hoa" };
    return reply.send({
      success: true,
      employee: updated,
      message: `Đã cấp ${amount} ${labels[type]} cho ${emp.name}`,
    });
  });

  // GET /api/v1/admin/templates/card — info for all 3 template slots
  app.get("/templates/card", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const templatesDir = path.join(UPLOAD_DIR, "templates");
    const slots = [1, 2, 3].map((id) => {
      const previewPath = path.join(templatesDir, `card_preview_${id}.jpg`);
      const hasTemplate = fs.existsSync(previewPath);
      return { id, hasTemplate, previewUrl: hasTemplate ? `/uploads/templates/card_preview_${id}.jpg` : null };
    });
    return reply.send({ slots });
  });

  // POST /api/v1/admin/templates/card — upload card background for a specific slot
  // multipart: "file" + "template_id" (1|2|3)
  app.post("/templates/card", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest, reply) => {
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    const templatesDir = path.join(UPLOAD_DIR, "templates");
    fs.mkdirSync(templatesDir, { recursive: true });

    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let templateId = 1;

    try {
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "file") {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of part.file) {
            size += chunk.length;
            if (size > MAX_SIZE) {
              return reply.code(400).send({ success: false, error: "FILE_TOO_LARGE", message: "Ảnh tối đa 15MB" });
            }
            chunks.push(chunk);
          }
          fileBuffer = Buffer.concat(chunks);
          console.log(`[Template upload] file size: ${fileBuffer.length} bytes`);
        } else if (part.type === "field" && part.fieldname === "template_id") {
          templateId = Math.max(1, Math.min(3, parseInt(part.value as string) || 1));
          console.log(`[Template upload] template_id: ${templateId}`);
        }
      }
    } catch (err: any) {
      console.error("[Template upload] multipart error:", err.message);
      return reply.code(400).send({ success: false, error: "UPLOAD_ERROR", message: err.message || "Lỗi upload file" });
    }

    if (!fileBuffer) {
      return reply.code(400).send({ success: false, error: "NO_FILE", message: "Không có ảnh được tải lên" });
    }

    // Save full-res (1080×1350)
    const templateBuffer = await sharp(fileBuffer).resize(1080, 1350, { fit: "cover" }).png().toBuffer();
    fs.writeFileSync(path.join(templatesDir, `card_${templateId}.png`), templateBuffer);

    // Save preview (300×375)
    const previewBuffer = await sharp(fileBuffer).resize(300, 375, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    fs.writeFileSync(path.join(templatesDir, `card_preview_${templateId}.jpg`), previewBuffer);
    console.log(`[Template upload] Saved template #${templateId} (${templateBuffer.length} bytes PNG, ${previewBuffer.length} bytes preview)`);

    return reply.send({
      success: true,
      templateId,
      previewUrl: `/uploads/templates/card_preview_${templateId}.jpg`,
      message: `Mẫu thiệp #${templateId} đã cập nhật! Nhấn "Tái tạo thiệp" để áp dụng.`,
    });
  });

  // GET /api/v1/admin/greetings — lấy danh sách lời chúc hiện tại
  app.get("/greetings", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    return reply.send({ greetings: getGreetingsList() });
  });

  // PUT /api/v1/admin/greetings — lưu danh sách lời chúc mới
  app.put("/greetings", { preHandler: [app.authenticate, app.adminOnly] }, async (req: FastifyRequest<{ Body: { greetings: string[] } }>, reply) => {
    const { greetings } = req.body as { greetings: string[] };
    if (!Array.isArray(greetings) || greetings.length === 0) {
      return reply.code(400).send({ success: false, message: "Danh sách lời chúc không được rỗng" });
    }
    const cleaned = greetings.map((s: string) => String(s).trim()).filter(Boolean);
    fs.writeFileSync(GREETINGS_FILE, JSON.stringify(cleaned, null, 2), "utf8");
    return reply.send({ success: true, count: cleaned.length, message: `Đã lưu ${cleaned.length} lời chúc` });
  });

  // POST /api/v1/admin/templates/regenerate — regenerate all employee cards with new template
  app.post("/templates/regenerate", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const employees = await prisma.employee.findMany({
      where: { role: "user", selfieUrl: { not: null } },
      select: { id: true, name: true, dept: true, cardTemplateId: true },
    });

    // Return immediately, regenerate in background
    reply.send({ success: true, total: employees.length, message: `Đang tái tạo ${employees.length} thiệp trong nền...` });

    setImmediate(async () => {
      let done = 0;
      for (const emp of employees) {
        try {
          const selfieLocalPath = path.join(UPLOAD_DIR, "selfies", `${emp.id}.jpg`);
          if (!fs.existsSync(selfieLocalPath)) continue;
          const cardUrl = await generateCardImage({
            userId: emp.id,
            name: emp.name,
            dept: emp.dept,
            selfieLocalPath,
            templateId: emp.cardTemplateId || 1,
          });
          await prisma.employee.update({ where: { id: emp.id }, data: { cardImageUrl: cardUrl } });
          done++;
        } catch (e) {
          console.error("[Regenerate] Error for", emp.id, e);
        }
      }
      console.log(`[Regenerate] Done: ${done}/${employees.length} cards`);
    });
  });

  // POST /api/v1/admin/results/regenerate — regenerate all result images (after theme change)
  app.post("/results/regenerate", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const eventRound = await getCurrentEventRound();
    const spunEmployees = await prisma.employee.findMany({
      where: { hasSpun: true },
      select: { id: true, name: true, dept: true, position: true, selfieUrl: true, cardTemplateId: true },
    });

    const spinLogs = await prisma.spinLog.findMany({
      where: { userId: { in: spunEmployees.map((e) => e.id) }, eventRound },
      select: { userId: true, tier: true },
    });
    const tierMap = new Map(spinLogs.map((s) => [s.userId, s.tier]));

    reply.send({ success: true, total: spunEmployees.length, message: `Đang tái tạo ${spunEmployees.length} ảnh kết quả trong nền...` });

    setImmediate(async () => {
      let done = 0;
      for (const emp of spunEmployees) {
        try {
          const tier = tierMap.get(emp.id);
          if (!tier) continue;
          const selfieLocalPath = emp.selfieUrl
            ? path.join(UPLOAD_DIR, "selfies", `${emp.id}.jpg`)
            : null;
          const resultUrl = await generateResultImage({
            userId: emp.id,
            name: emp.name,
            dept: emp.dept,
            position: emp.position || "",
            tier: tier as any,
            selfieLocalPath,
            templateId: emp.cardTemplateId || 1,
          });
          await prisma.employee.update({ where: { id: emp.id }, data: { resultImageUrl: resultUrl } });
          done++;
        } catch (e) {
          console.error("[RegenResults] Error for", emp.id, e);
        }
      }
      console.log(`[RegenResults] Done: ${done}/${spunEmployees.length} result images`);
    });
  });
}
