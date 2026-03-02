import { FastifyInstance, FastifyRequest } from "fastify";
import { sendWish, getReceivedWishes, getWishFeed } from "../services/wish.service";

export async function wishRoutes(app: FastifyInstance) {
  // POST /api/v1/wishes — auth required
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest<{ Body: { toId?: string; flower?: string; message: string } }>, reply) => {
      const { toId, flower, message } = req.body || {};
      if (!message) return reply.code(400).send({ error: "BAD_REQUEST", message: "Tin nhắn không được để trống" });

      const result = await sendWish(
        (req as any).user.id,
        toId || null,
        flower || "🌸",
        message
      );

      if ("error" in result) {
        const status = result.code === "RATE_LIMITED" ? 429 : 400;
        return reply.code(status).send({ error: result.code, message: result.error });
      }

      return reply.send(result);
    }
  );

  // GET /api/v1/wishes/received — auth required
  app.get("/received", { preHandler: [app.authenticate] }, async (req, reply) => {
    const wishes = await getReceivedWishes((req as any).user.id);
    return reply.send({ wishes });
  });

  // GET /api/v1/wishes/feed?limit=30 — public
  app.get("/feed", async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply) => {
    const limit = Math.min(parseInt(req.query.limit || "30", 10) || 30, 50);
    const wishes = await getWishFeed(limit);
    return reply.send({ wishes });
  });
}
