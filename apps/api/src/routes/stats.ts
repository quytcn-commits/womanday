import { FastifyInstance, FastifyRequest } from "fastify";
import { getEventTime, getLiveStats, getRecentWinners } from "../services/stats.service";

export async function statsRoutes(app: FastifyInstance) {
  // GET /api/v1/stats/event-time — public, no auth
  app.get("/event-time", async (_req, reply) => {
    const data = await getEventTime();
    return reply.send(data);
  });

  // GET /api/v1/stats/live — public, no auth
  app.get("/live", async (_req, reply) => {
    const data = await getLiveStats();
    return reply.send(data);
  });

  // GET /api/v1/stats/recent-winners?limit=20 — public
  app.get("/recent-winners", async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply) => {
    const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 50);
    const winners = await getRecentWinners(limit);
    return reply.send({ winners });
  });
}
