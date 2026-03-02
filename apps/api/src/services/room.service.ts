import prisma from "../lib/prisma";
import { getIo } from "../websocket";
import timerService from "./timer.service";
import { getCurrentEventRound } from "../lib/event-round";

// Generate sequential room ID like R001, R002...
async function generateRoomId(): Promise<string> {
  const count = await prisma.room.count();
  return `R${String(count + 1).padStart(3, "0")}`;
}

export async function createRoom(adminId: string, name?: string): Promise<string> {
  const id = await generateRoomId();
  const eventRound = await getCurrentEventRound();
  await prisma.room.create({
    data: { id, name: name || null, status: "CREATED", capacity: 12, createdBy: adminId, eventRound },
  });

  const io = getIo();
  io.emit("room_created", {
    event: "room_created",
    roomId: id,
    name: name || null,
    qrUrl: `${process.env.CORS_ORIGIN || "http://localhost:3000"}/join?room=${id}`,
    createdAt: new Date().toISOString(),
  });

  return id;
}

export async function updateRoom(roomId: string, name: string): Promise<{ success: boolean } | { error: string; code: number }> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { error: "ROOM_NOT_FOUND", code: 404 };
  await prisma.room.update({ where: { id: roomId }, data: { name } });
  return { success: true };
}

export async function deleteRoom(roomId: string): Promise<{ success: boolean } | { error: string; code: number }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { _count: { select: { participants: true } } },
  });
  if (!room) return { error: "ROOM_NOT_FOUND", code: 404 };
  if (!["CREATED", "DONE"].includes(room.status)) {
    return { error: "ROOM_ACTIVE", code: 400 };
  }
  // Delete related data first
  await prisma.chatMessage.deleteMany({ where: { roomId } });
  await prisma.generatedImage.deleteMany({ where: { roomId } });
  await prisma.spinLog.deleteMany({ where: { roomId } });
  await prisma.roomParticipant.deleteMany({ where: { roomId } });
  await prisma.room.delete({ where: { id: roomId } });
  return { success: true };
}

export async function getRoomWithParticipants(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      participants: {
        include: { user: { select: { name: true, dept: true, position: true, selfieUrl: true } } },
        orderBy: { slotIndex: "asc" },
      },
    },
  });
  if (!room) return null;

  const slots = Array.from({ length: 12 }, (_, i) => {
    const p = room.participants.find((x) => x.slotIndex === i + 1);
    if (p) {
      return {
        slotIndex: i + 1,
        userId: p.userId,
        name: p.user.name,
        dept: p.user.dept,
        position: p.user.position,
        selfieUrl: p.user.selfieUrl,
        state: p.state,
      };
    }
    return { slotIndex: i + 1, userId: null, name: null, dept: null, position: null, selfieUrl: null, state: "EMPTY" };
  });

  return {
    id: room.id,
    name: room.name || null,
    status: room.status,
    capacity: room.capacity,
    participantCount: room.participants.length,
    participants: slots,
    waitingStartedAt: room.waitingStartedAt?.toISOString() ?? null,
    autoStartAt: room.autoStartAt?.toISOString() ?? null,
    lockedAt: room.lockedAt?.toISOString() ?? null,
    countdownStartedAt: room.countdownStartedAt?.toISOString() ?? null,
    spinStartedAt: room.spinStartedAt?.toISOString() ?? null,
    doneAt: room.doneAt?.toISOString() ?? null,
  };
}

// ══════════════════════════════════════════════════════════
// joinRoom — ATOMIC with FOR UPDATE row lock
// Đảm bảo 400 người join cùng lúc, chỉ 12 người sớm nhất
// vào phòng. Không race condition, không duplicate slot.
// ══════════════════════════════════════════════════════════
export async function joinRoom(
  userId: string,
  roomId: string
): Promise<{ slotIndex: number } | { error: string; code: number }> {
  // Pre-check user (read-only, no race concern)
  const employee = await prisma.employee.findUnique({ where: { id: userId } });
  if (!employee) return { error: "USER_NOT_FOUND", code: 404 };
  if (employee.hasSpun) return { error: "ALREADY_SPUN", code: 403 };

  // Check if user already in another ACTIVE room (chưa DONE)
  const existingInOtherRoom = await prisma.roomParticipant.findFirst({
    where: {
      userId,
      room: { status: { notIn: ["DONE"] } },
    },
    include: { room: { select: { id: true, status: true } } },
  });
  if (existingInOtherRoom) {
    if (existingInOtherRoom.roomId === roomId) {
      return { error: "ALREADY_IN_ROOM", code: 409 };
    }
    return { error: "IN_ANOTHER_ROOM", code: 409 };
  }

  let slotIndex: number;
  let newCount: number;
  let isFirstParticipant: boolean;
  let shouldLockRoom: boolean;

  try {
    const txResult = await prisma.$transaction(
      async (tx) => {
        // ── 1. Lock room row exclusively ────────────────
        // FOR UPDATE serializes ALL joins for the same room.
        // 400 requests queue up; each takes ~2-5ms → all done in <3s.
        const rooms = await tx.$queryRaw<
          Array<{ id: string; status: string; capacity: number }>
        >`SELECT "id", "status", "capacity" FROM "rooms" WHERE "id" = ${roomId} FOR UPDATE`;

        const room = rooms[0];
        if (!room) {
          throw Object.assign(new Error("ROOM_NOT_FOUND"), { statusCode: 404 });
        }
        if (!["CREATED", "WAITING"].includes(room.status)) {
          throw Object.assign(new Error("ROOM_LOCKED"), { statusCode: 423 });
        }

        // ── 2. Check duplicate (under lock = safe) ─────
        const existing = await tx.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });
        if (existing) {
          throw Object.assign(new Error("ALREADY_IN_ROOM"), { statusCode: 409 });
        }

        // ── 3. Count + find next slot (under lock = safe) ─
        const participants = await tx.roomParticipant.findMany({
          where: { roomId },
          select: { slotIndex: true },
          orderBy: { slotIndex: "asc" },
        });

        if (participants.length >= room.capacity) {
          throw Object.assign(new Error("ROOM_FULL"), { statusCode: 409 });
        }

        const usedSlots = new Set(participants.map((p) => p.slotIndex));
        let nextSlot = 1;
        while (usedSlots.has(nextSlot)) nextSlot++;

        // ── 4. Create participant atomically ───────────
        await tx.roomParticipant.create({
          data: { roomId, userId, slotIndex: nextSlot, state: "JOINED" },
        });

        const count = participants.length + 1;

        // ── 5. First participant → set WAITING + schedule timer ─
        if (participants.length === 0) {
          const now = new Date();
          const waitingMs = parseInt(process.env.WAITING_TIMER_MS || "30000");
          const autoStartAt = new Date(now.getTime() + waitingMs);
          await tx.room.update({
            where: { id: roomId },
            data: { status: "WAITING", waitingStartedAt: now, autoStartAt },
          });
        }

        return {
          slotIndex: nextSlot,
          count,
          isFirst: participants.length === 0,
          shouldLock: count >= room.capacity,
        };
      },
      {
        // 400 concurrent requests: worst case ~12 * 5ms = 60ms lock time
        // + queueing delay. 10s timeout is very generous.
        timeout: 10000,
        maxWait: 10000,
      }
    );

    slotIndex = txResult.slotIndex;
    newCount = txResult.count;
    isFirstParticipant = txResult.isFirst;
    shouldLockRoom = txResult.shouldLock;
  } catch (err: any) {
    // ── Map transaction errors to HTTP responses ───
    const msg = err.message || "";

    if (msg === "ROOM_NOT_FOUND") return { error: "ROOM_NOT_FOUND", code: 404 };
    if (msg === "ROOM_LOCKED") return { error: "ROOM_LOCKED", code: 423 };
    if (msg === "ALREADY_IN_ROOM") return { error: "ALREADY_IN_ROOM", code: 409 };
    if (msg === "ROOM_FULL") return { error: "ROOM_FULL", code: 409 };

    // Prisma unique constraint violation (safety net)
    if (err.code === "P2002") {
      const target = err.meta?.target || [];
      if (target.includes("roomId") && target.includes("userId")) {
        return { error: "ALREADY_IN_ROOM", code: 409 };
      }
      if (target.includes("roomId") && target.includes("slotIndex")) {
        // Slot conflict — shouldn't happen with FOR UPDATE, but just in case
        return { error: "SLOT_CONFLICT", code: 409 };
      }
      return { error: "ALREADY_IN_ROOM", code: 409 };
    }

    // Transaction timeout (server overloaded)
    if (msg.includes("Transaction already closed") || msg.includes("timed out")) {
      console.error(`[JoinRoom] Transaction timeout for room ${roomId}, user ${userId}`);
      return { error: "SERVER_BUSY", code: 503 };
    }

    // Unexpected error — log and rethrow
    console.error(`[JoinRoom] Unexpected error:`, err);
    throw err;
  }

  // ══════════════════════════════════════════════════════════
  // Side effects — OUTSIDE transaction (don't hold the lock)
  // ══════════════════════════════════════════════════════════
  const io = getIo();

  // Schedule auto-lock timer (first participant only)
  if (isFirstParticipant) {
    const waitingMs = parseInt(process.env.WAITING_TIMER_MS || "30000");
    timerService.scheduleAutoLock(roomId, waitingMs);
  }

  // Emit participant joined event
  io.to(`room:${roomId}`).emit("participant_joined", {
    event: "participant_joined",
    roomId,
    slotIndex,
    participant: {
      userId,
      name: employee.name,
      dept: employee.dept,
      selfieUrl: employee.selfieUrl,
    },
    participantCount: newCount,
  });

  // Also emit to global listeners (wall page)
  io.emit("participant_joined", {
    event: "participant_joined",
    roomId,
    slotIndex,
    participant: {
      userId,
      name: employee.name,
      dept: employee.dept,
      selfieUrl: employee.selfieUrl,
    },
    participantCount: newCount,
  });

  // Room full → auto lock (outside transaction, uses atomic updateMany)
  if (shouldLockRoom) {
    timerService.cancelAutoLock(roomId);
    await lockRoom(roomId, "ROOM_FULL");
  }

  return { slotIndex };
}

// ══════════════════════════════════════════════════════════
// lockRoom — ATOMIC using updateMany with status condition
// Chống double-lock: chỉ 1 process lock thành công.
// ══════════════════════════════════════════════════════════
export async function lockRoom(
  roomId: string,
  reason: "ADMIN_TRIGGERED" | "TIMER_EXPIRED" | "ROOM_FULL"
) {
  // Atomic: UPDATE only WHERE status = 'WAITING'
  // If two processes race (timer + room_full), only ONE succeeds.
  const result = await prisma.room.updateMany({
    where: { id: roomId, status: "WAITING" },
    data: { status: "LOCKED", lockedAt: new Date() },
  });

  // If no rows affected, room was already locked by another process
  if (result.count === 0) {
    console.log(`[LockRoom] Room ${roomId} already locked (race avoided), reason was: ${reason}`);
    return;
  }

  console.log(`[LockRoom] Room ${roomId} locked, reason: ${reason}`);

  const count = await prisma.roomParticipant.count({ where: { roomId } });
  const io = getIo();

  const lockedPayload = {
    event: "room_locked",
    roomId,
    reason,
    participantCount: count,
  };
  io.to(`room:${roomId}`).emit("room_locked", lockedPayload);
  io.to("wall").emit("room_locked", lockedPayload);

  // Immediately start countdown
  await startCountdown(roomId);
}

export async function startCountdown(roomId: string) {
  const countdownSec = parseInt(process.env.COUNTDOWN_SECONDS || "30");

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "COUNTDOWN", countdownStartedAt: new Date() },
  });

  const io = getIo();
  const spinAt = new Date(Date.now() + countdownSec * 1000);

  const countdownPayload = {
    event: "countdown_started",
    roomId,
    remainingSeconds: countdownSec,
    spinAt: spinAt.toISOString(),
  };
  io.to(`room:${roomId}`).emit("countdown_started", countdownPayload);
  io.to("wall").emit("countdown_started", countdownPayload);

  let remaining = countdownSec - 1;
  const tick = setInterval(async () => {
    if (remaining <= 0) {
      clearInterval(tick);
      const { executeSpin } = await import("./spin.service");
      await executeSpin(roomId);
      return;
    }
    const tickPayload = {
      event: "countdown_tick",
      roomId,
      remainingSeconds: remaining,
    };
    io.to(`room:${roomId}`).emit("countdown_tick", tickPayload);
    io.to("wall").emit("countdown_tick", tickPayload);
    remaining--;
  }, 1000);
}

export async function adminStartNow(adminId: string, roomId: string) {
  const admin = await prisma.employee.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "admin") return { error: "FORBIDDEN", code: 403 };

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return { error: "ROOM_NOT_FOUND", code: 404 };
  if (room.status !== "WAITING") return { error: "ROOM_NOT_WAITING", code: 400 };

  const count = await prisma.roomParticipant.count({ where: { roomId } });
  if (count === 0) return { error: "ROOM_EMPTY", code: 400 };

  timerService.cancelAutoLock(roomId);
  await lockRoom(roomId, "ADMIN_TRIGGERED");
  return { success: true };
}

export async function getActiveRooms() {
  const eventRound = await getCurrentEventRound();
  return prisma.room.findMany({
    where: { status: { notIn: ["DONE"] }, eventRound },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllRooms() {
  const eventRound = await getCurrentEventRound();
  return prisma.room.findMany({
    where: { eventRound },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCurrentWaitingRoom() {
  const eventRound = await getCurrentEventRound();
  return prisma.room.findFirst({
    where: { status: "WAITING", eventRound },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "asc" },
  });
}
