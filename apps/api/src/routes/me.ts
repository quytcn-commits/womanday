import { FastifyInstance, FastifyRequest } from "fastify";
import { sanitizeEmployee } from "../services/auth.service";
import { getGreeting } from "../services/image.service";
import prisma from "../lib/prisma";

export async function meRoutes(app: FastifyInstance) {
  // GET /api/v1/me
  app.get("/", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;
    const emp = await prisma.employee.findUnique({ where: { id: userId } });
    if (!emp) return reply.code(404).send({ error: "NOT_FOUND" });
    return reply.send({ ...sanitizeEmployee(emp), greeting: getGreeting(userId) });
  });
}
