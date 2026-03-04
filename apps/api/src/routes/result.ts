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

    // Return relative path — frontend uses getApiUrl() to build full URL
    const imageUrl = emp.resultImageUrl || null;
    const shareUrl = null; // share URL built client-side

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
