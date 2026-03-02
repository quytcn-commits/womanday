import { FastifyInstance } from "fastify";
import { joinEvent, getEventInfo, getActiveRoomFull } from "../services/event.service";

export async function eventRoutes(app: FastifyInstance) {
  // GET /api/v1/event/info — public
  app.get("/info", async (_req, reply) => {
    const info = await getEventInfo();
    return reply.send(info);
  });

  // POST /api/v1/event/join — authenticated: auto-assign user to a room
  app.post("/join", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id;
    const result = await joinEvent(userId);

    if ("error" in result) {
      const messages: Record<string, string> = {
        EVENT_NOT_RUNNING: "Su kien chua bat dau hoac da ket thuc",
        USER_NOT_FOUND: "Khong tim thay tai khoan",
        ALREADY_SPUN: "Ban da quay thuong roi",
        IN_ANOTHER_ROOM: "Ban dang o phong khac",
        ROOM_FULL: "Tat ca phong deu day, vui long thu lai",
        NO_ROOM_AVAILABLE: "Khong co phong trong, vui long thu lai",
        SERVER_BUSY: "Server dang ban, vui long thu lai",
      };
      return reply.code(result.code).send({
        success: false,
        error: result.error,
        message: messages[result.error] || "Khong the tham gia",
      });
    }

    return reply.send({
      success: true,
      roomId: result.roomId,
      slotIndex: result.slotIndex,
    });
  });

  // GET /api/v1/event/active-room — public: current active room for viewers
  app.get("/active-room", async (_req, reply) => {
    const room = await getActiveRoomFull();
    return reply.send({ activeRoom: room });
  });
}
