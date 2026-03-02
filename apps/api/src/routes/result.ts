import { FastifyInstance, FastifyRequest } from "fastify";
import prisma from "../lib/prisma";
import { getCurrentEventRound } from "../lib/event-round";

export async function resultRoutes(app: FastifyInstance) {
  // GET /api/v1/result/image
  app.get("/image", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;
    const emp = await prisma.employee.findUnique({
      where: { id: userId },
      select: { resultImageUrl: true, name: true, dept: true },
    });
    if (!emp) return reply.code(404).send({ error: "NOT_FOUND" });

    const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";
    const API = `${BASE.replace("3000", "3001")}`;

    const imageUrl = emp.resultImageUrl ? `${API}${emp.resultImageUrl}` : null;
    const shareUrl = imageUrl
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`
      : null;

    const eventRound = await getCurrentEventRound();
    const spinLog = await prisma.spinLog.findUnique({
      where: { userId_eventRound: { userId, eventRound } },
      include: { prize: { select: { label: true } } },
    });

    const prizeLabel = spinLog
      ? (spinLog.prize.label || spinLog.tier)
      : null;
    const caption = prizeLabel
      ? `Hôm nay mình vui quá! Mình đã nhận được ${prizeLabel} trong sự kiện 8/3 của công ty! 🌸✨ #WomensDay #NgayPhuNu #8thMarch`
      : null;

    return reply.send({
      resultImageUrl: imageUrl,
      shareUrl,
      caption,
      spinLog: spinLog
        ? { tier: spinLog.tier, value: spinLog.value, label: spinLog.prize.label || spinLog.tier, spunAt: spinLog.spunAt.toISOString() }
        : null,
    });
  });
}
