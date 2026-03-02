import prisma from "../lib/prisma";
import { getIo } from "../websocket";
import { PrizeTier, PRIZE_LABELS } from "@womanday/types";
import { generateResultImage } from "./image.service";
import { getCurrentEventRound } from "../lib/event-round";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export async function executeSpin(roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return;
  if (room.status === "DONE") return; // Already done

  const io = getIo();

  // 1. Mark SPINNING
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "SPINNING", spinStartedAt: new Date() },
  });

  const spinPayload = {
    event: "spin_started",
    roomId,
    startedAt: new Date().toISOString(),
  };
  io.to(`room:${roomId}`).emit("spin_started", spinPayload);
  io.to("wall").emit("spin_started", spinPayload);

  // 2. Get participants ordered by slot
  const participants = await prisma.roomParticipant.findMany({
    where: { roomId },
    include: { user: true },
    orderBy: { slotIndex: "asc" },
  });

  if (participants.length === 0) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "DONE", doneAt: new Date() } });
    return;
  }

  const eventRound = await getCurrentEventRound();

  // 3. Assign prizes atomically
  interface SpinResult {
    slotIndex: number;
    userId: string;
    name: string;
    dept: string;
    position: string;
    selfieUrl: string | null;
    tier: PrizeTier;
    value: number;
    label: string;
    prizeId: string;
  }
  const results: SpinResult[] = [];

  for (const participant of participants) {
    // Idempotent: check existing spin log (per round)
    const existing = await prisma.spinLog.findUnique({
      where: { userId_eventRound: { userId: participant.userId, eventRound } },
    });
    if (existing) {
      const existingPrize = await prisma.prize.findUnique({ where: { id: existing.prizeId }, select: { label: true } });
      results.push({
        slotIndex: participant.slotIndex,
        userId: participant.userId,
        name: participant.user.name,
        dept: participant.user.dept,
        position: participant.user.position,
        selfieUrl: participant.user.selfieUrl,
        tier: existing.tier as PrizeTier,
        value: existing.value,
        label: existingPrize?.label || PRIZE_LABELS[existing.tier] || existing.tier,
        prizeId: existing.prizeId,
      });
      continue;
    }

    // Pick random unassigned prize using raw SQL for SKIP LOCKED
    const prizes = await prisma.$queryRaw<{ id: string; tier: string; value: number; label: string }[]>`
      SELECT id, tier, value, label FROM prize_pool
      WHERE assigned = false AND "eventRound" = ${eventRound}
      ORDER BY RANDOM()
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (!prizes || prizes.length === 0) {
      console.error(`[Spin] Prize pool exhausted for room ${roomId}`);
      io.to(`room:${roomId}`).emit("system_message", {
        event: "system_message",
        roomId,
        message: "Lỗi hệ thống: Không đủ phần thưởng",
        type: "error",
      });
      break;
    }

    const prize = prizes[0];

    await prisma.$transaction([
      prisma.prize.update({
        where: { id: prize.id },
        data: { assigned: true, assignedTo: participant.userId, assignedAt: new Date() },
      }),
      prisma.spinLog.create({
        data: {
          roomId,
          userId: participant.userId,
          prizeId: prize.id,
          tier: prize.tier,
          value: prize.value,
          slotIndex: participant.slotIndex,
          eventRound,
        },
      }),
      prisma.employee.update({
        where: { id: participant.userId },
        data: { hasSpun: true },
      }),
    ]);

    results.push({
      slotIndex: participant.slotIndex,
      userId: participant.userId,
      name: participant.user.name,
      dept: participant.user.dept,
      position: participant.user.position,
      selfieUrl: participant.user.selfieUrl,
      tier: prize.tier as PrizeTier,
      value: prize.value,
      label: prize.label || PRIZE_LABELS[prize.tier] || prize.tier,
      prizeId: prize.id,
    });
  }

  // 4. Reveal results sequentially
  await prisma.room.update({ where: { id: roomId }, data: { status: "REVEAL" } });

  for (let i = 0; i < results.length; i++) {
    await delay(300);
    const r = results[i];
    const isHighTier = r.tier !== "CONS" && r.value > 210000;
    const revealPayload = {
      event: "reveal_result",
      roomId,
      slotIndex: r.slotIndex,
      sequence: i + 1,
      totalSlots: results.length,
      user: {
        userId: r.userId,
        name: r.name,
        dept: r.dept,
        selfieUrl: r.selfieUrl,
      },
      prize: {
        tier: r.tier,
        value: r.value,
        label: r.label,
      },
      isHighTier,
    };
    io.to(`room:${roomId}`).emit("reveal_result", revealPayload);
    io.to("wall").emit("reveal_result", revealPayload);

    // Broadcast winner to wall channel for live feed
    io.to("wall").emit("winner_announced", {
      event: "winner_announced",
      name: r.name,
      dept: r.dept,
      tier: r.tier,
      value: r.value,
      label: r.label,
      isHighTier,
      spunAt: new Date().toISOString(),
    });
  }

  await delay(2000);

  // 5. Room done
  await prisma.room.update({ where: { id: roomId }, data: { status: "DONE", doneAt: new Date() } });

  const summary: Record<string, number> = { FIRST: 0, SECOND: 0, THIRD: 0, CONS: 0 };
  results.forEach((r) => { summary[r.tier] = (summary[r.tier] || 0) + 1; });

  const resultsPayload = {
    event: "room_results_ready",
    roomId,
    results: results.map((r) => ({
      slotIndex: r.slotIndex,
      userId: r.userId,
      name: r.name,
      dept: r.dept,
      tier: r.tier,
      value: r.value,
      resultImageUrl: null, // filled after async image gen
    })),
    summary,
  };
  io.to(`room:${roomId}`).emit("room_results_ready", resultsPayload);
  io.to("wall").emit("room_results_ready", resultsPayload);

  // 6. Notify event channel: switch to next active room after delay
  setTimeout(async () => {
    try {
      const { getActiveRoom } = await import("./event.service");
      const nextRoom = await getActiveRoom();
      const payload = {
        event: "active_room_changed",
        roomId: nextRoom?.roomId || null,
        status: nextRoom?.status || "NO_ACTIVE_ROOM",
      };
      io.to("event").emit("active_room_changed", payload);
      io.to("wall").emit("active_room_changed", payload);
    } catch (e) {
      console.error("[Spin] Error notifying event channel:", e);
    }
  }, 5000);

  // 7. Async: generate result images
  for (const r of results) {
    generateResultImageAsync(r, roomId, io);
  }
}

async function generateResultImageAsync(
  r: {
    userId: string;
    name: string;
    dept: string;
    position: string;
    selfieUrl: string | null;
    tier: PrizeTier;
    value: number;
  },
  roomId: string,
  io: ReturnType<typeof getIo>
) {
  try {
    const selfieLocalPath = r.selfieUrl
      ? path.join(UPLOAD_DIR, r.selfieUrl.replace("/uploads/", ""))
      : null;

    const employee = await prisma.employee.findUnique({ where: { id: r.userId } });
    const templateId = employee?.cardTemplateId || 1;

    const imageUrl = await generateResultImage({
      userId: r.userId,
      name: r.name,
      dept: r.dept,
      position: r.position,
      tier: r.tier,
      selfieLocalPath,
      templateId,
    });

    await prisma.employee.update({ where: { id: r.userId }, data: { resultImageUrl: imageUrl } });
    await prisma.generatedImage.create({
      data: { userId: r.userId, roomId, type: "result", imageUrl },
    });

    io.to(`user:${r.userId}`).emit("image_ready", {
      event: "image_ready",
      userId: r.userId,
      type: "result",
      imageUrl,
    });
  } catch (e) {
    console.error(`[Spin] Image gen failed for ${r.userId}:`, e);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getRoomResults(roomId: string) {
  return prisma.spinLog.findMany({
    where: { roomId },
    include: { user: { select: { name: true, dept: true, selfieUrl: true, resultImageUrl: true } } },
    orderBy: { slotIndex: "asc" },
  });
}
