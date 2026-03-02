import { FastifyInstance, FastifyRequest } from "fastify";
import {
  getRoomWithParticipants,
  joinRoom,
  getCurrentWaitingRoom,
} from "../services/room.service";
import { getRoomResults } from "../services/spin.service";

export async function roomRoutes(app: FastifyInstance) {
  // GET /api/v1/rooms/active  — public: list all non-DONE rooms (for wall display)
  app.get("/active", async (_req, reply) => {
    const { getAllRooms } = await import("../services/room.service");
    const rooms = await getAllRooms();
    const active = rooms.filter((r) => r.status !== "DONE");
    const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.send({
      rooms: active.map((r) => ({
        id: r.id,
        status: r.status,
        participantCount: (r as any)._count?.participants ?? 0,
        qrUrl: `${BASE}/join?room=${r.id}`,
      })),
    });
  });

  // GET /api/v1/rooms/current  — tìm phòng WAITING hiện tại
  app.get("/current", { preHandler: [app.authenticate] }, async (_req, reply) => {
    const room = await getCurrentWaitingRoom();
    if (!room) return reply.send({ room: null, message: "Không có phòng trống. Chờ admin tạo phòng mới." });

    const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.send({
      room: {
        id: room.id,
        status: room.status,
        capacity: room.capacity,
        participantCount: (room as any)._count.participants,
        waitingStartedAt: room.waitingStartedAt?.toISOString() ?? null,
        autoStartAt: room.autoStartAt?.toISOString() ?? null,
        qrUrl: `${BASE}/join?room=${room.id}`,
      },
    });
  });

  // GET /api/v1/rooms/:roomId
  app.get("/:roomId", { preHandler: [app.authenticate] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const room = await getRoomWithParticipants(req.params.roomId);
    if (!room) return reply.code(404).send({ error: "ROOM_NOT_FOUND" });
    return reply.send(room);
  });

  // POST /api/v1/rooms/:roomId/join
  app.post("/:roomId/join", { preHandler: [app.authenticate] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const userId = (req.user as { id: string }).id;
    const result = await joinRoom(userId, req.params.roomId);

    if ("error" in result) {
      const messages: Record<string, string> = {
        USER_NOT_FOUND: "Không tìm thấy tài khoản",
        ALREADY_SPUN: "Bạn đã quay thưởng rồi",
        IN_ANOTHER_ROOM: "Bạn đang ở phòng khác",
        ROOM_NOT_FOUND: "Không tìm thấy phòng",
        ROOM_LOCKED: "Phòng đã khóa, vui lòng chờ phòng mới",
        ALREADY_IN_ROOM: "Bạn đã tham gia phòng này rồi",
        ROOM_FULL: "Phòng đã đầy (12/12)",
        SLOT_CONFLICT: "Lỗi xung đột slot, thử lại",
        SERVER_BUSY: "Server đang bận, vui lòng thử lại sau giây lát",
      };
      return reply.code(result.code).send({
        success: false,
        error: result.error,
        message: messages[result.error] || "Không thể tham gia phòng",
      });
    }

    return reply.send({ success: true, slotIndex: result.slotIndex, roomId: req.params.roomId });
  });

  // GET /api/v1/rooms/:roomId/results
  app.get("/:roomId/results", { preHandler: [app.authenticate] }, async (req: FastifyRequest<{ Params: { roomId: string } }>, reply) => {
    const results = await getRoomResults(req.params.roomId);
    return reply.send({
      roomId: req.params.roomId,
      results: results.map((r) => ({
        slotIndex: r.slotIndex,
        userId: r.userId,
        name: r.user.name,
        dept: r.user.dept,
        tier: r.tier,
        value: r.value,
        resultImageUrl: r.user.resultImageUrl,
      })),
    });
  });
}
