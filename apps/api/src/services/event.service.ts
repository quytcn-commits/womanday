import prisma from "../lib/prisma";
import { getIo } from "../websocket";
import { joinRoom, createRoom, getRoomWithParticipants } from "./room.service";
import { getCurrentEventRound } from "../lib/event-round";

/**
 * Auto-join user to event: find available room or create one, then join.
 * Handles race conditions with retry loop.
 */
export async function joinEvent(
  userId: string
): Promise<{ roomId: string; slotIndex: number } | { error: string; code: number }> {
  // Check event is RUNNING
  const eventStatus = await prisma.eventConfig.findUnique({ where: { key: "event_status" } });
  if (eventStatus?.value !== "RUNNING") {
    return { error: "EVENT_NOT_RUNNING", code: 400 };
  }

  // Pre-check user
  const employee = await prisma.employee.findUnique({ where: { id: userId } });
  if (!employee) return { error: "USER_NOT_FOUND", code: 404 };
  if (employee.hasSpun) return { error: "ALREADY_SPUN", code: 403 };

  // Check if user already in an active room → return that room directly
  const existing = await prisma.roomParticipant.findFirst({
    where: { userId, room: { status: { notIn: ["DONE"] } } },
    select: { roomId: true, slotIndex: true },
  });
  if (existing) {
    return { roomId: existing.roomId, slotIndex: existing.slotIndex };
  }

  const eventRound = await getCurrentEventRound();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Find available room with space
    const availableRooms = await prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT r."id"
      FROM "rooms" r
      WHERE r."status" IN ('CREATED', 'WAITING')
        AND r."eventRound" = ${eventRound}
        AND (SELECT COUNT(*) FROM "room_participants" rp WHERE rp."roomId" = r."id") < r."capacity"
      ORDER BY r."createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    let targetRoomId: string;

    if (availableRooms.length > 0) {
      targetRoomId = availableRooms[0].id;
    } else {
      // No available room → auto-create
      targetRoomId = await createRoom("SYSTEM");
      // Emit to event channel too
      const io = getIo();
      io.to("event").emit("room_created", {
        event: "room_created",
        roomId: targetRoomId,
        createdAt: new Date().toISOString(),
      });
    }

    // Attempt to join
    const result = await joinRoom(userId, targetRoomId);

    if ("error" in result) {
      // Room became full or locked between our SELECT and joinRoom → retry
      if (result.error === "ROOM_FULL" || result.error === "ROOM_LOCKED") {
        continue;
      }
      // ALREADY_IN_ROOM means user got in between our check and here (race)
      if (result.error === "ALREADY_IN_ROOM") {
        const p = await prisma.roomParticipant.findFirst({
          where: { userId, room: { status: { notIn: ["DONE"] } } },
          select: { roomId: true, slotIndex: true },
        });
        if (p) return { roomId: p.roomId, slotIndex: p.slotIndex };
      }
      return result;
    }

    // Notify event channel that a room is now active
    const io = getIo();
    io.to("event").emit("active_room_changed", {
      event: "active_room_changed",
      roomId: targetRoomId,
      status: "WAITING",
    });

    return { roomId: targetRoomId, slotIndex: result.slotIndex };
  }

  return { error: "NO_ROOM_AVAILABLE", code: 503 };
}

/**
 * Get event info: name, status, QR URL
 */
export async function getEventInfo() {
  const [nameCfg, statusCfg] = await Promise.all([
    prisma.eventConfig.findUnique({ where: { key: "event_name" } }),
    prisma.eventConfig.findUnique({ where: { key: "event_status" } }),
  ]);
  const eventRound = await getCurrentEventRound();
  const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";

  return {
    eventName: nameCfg?.value || "WomanDay Spin 8/3",
    eventStatus: statusCfg?.value || "PENDING",
    eventRound,
    qrUrl: `${BASE}/event`,
  };
}

/**
 * Find the current active room for viewers.
 * Priority: SPINNING > COUNTDOWN > REVEAL > LOCKED > WAITING > CREATED
 */
export async function getActiveRoom() {
  const eventRound = await getCurrentEventRound();
  const statusPriority = ["SPINNING", "COUNTDOWN", "REVEAL", "LOCKED", "WAITING", "CREATED"];

  for (const status of statusPriority) {
    const room = await prisma.room.findFirst({
      where: { status, eventRound },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    if (room) return { roomId: room.id, status: room.status };
  }

  return null;
}

/**
 * Get active room with full participant data (for API response)
 */
export async function getActiveRoomFull() {
  const active = await getActiveRoom();
  if (!active) return null;
  return getRoomWithParticipants(active.roomId);
}
