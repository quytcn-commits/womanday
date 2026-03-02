import { FastifyInstance, FastifyRequest } from "fastify";
import { getRecentMessages } from "../services/chat.service";

export async function chatRoutes(app: FastifyInstance) {
  // GET /api/v1/chat/messages?room_id=R001&limit=50
  app.get("/messages", async (req: FastifyRequest, reply) => {
    const { room_id, limit } = req.query as { room_id?: string; limit?: string };
    const messages = await getRecentMessages(room_id || null, parseInt(limit || "50"));
    return reply.send({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        name: m.user.name,
        dept: m.user.dept,
        message: m.message,
        type: m.type,
        reactions: m.reactions,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });
}
