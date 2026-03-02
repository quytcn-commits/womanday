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

    const header = "cccd,name,dept,position,tier,value,room_id,spun_at\n";
    const csv = header + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

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

  // GET /api/v1/admin/employees
  app.get("/employees", { preHandler: [app.authenticate, app.adminOnly] }, async (_req, reply) => {
    const employees = await prisma.employee.findMany({
      where: { role: "user" },
      select: { id: true, cccd: true, name: true, dept: true, position: true, hasSpun: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return reply.send({ employees, total: employees.length });
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
