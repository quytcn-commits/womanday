import prisma from "./prisma";

export async function getCurrentEventRound(): Promise<number> {
  const cfg = await prisma.eventConfig.findUnique({ where: { key: "event_round" } });
  return parseInt(cfg?.value || "1", 10);
}
