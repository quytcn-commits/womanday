import prisma from "../lib/prisma";
import { getCurrentEventRound } from "../lib/event-round";

export async function getEventTime() {
  const [startTimeCfg, statusCfg] = await Promise.all([
    prisma.eventConfig.findUnique({ where: { key: "event_start_time" } }),
    prisma.eventConfig.findUnique({ where: { key: "event_status" } }),
  ]);

  return {
    eventStartTime: startTimeCfg?.value || null,
    eventStatus: statusCfg?.value || "PENDING",
  };
}

async function getPrizeConfigMap(): Promise<Map<string, { label: string; color: string }>> {
  const cfg = await prisma.eventConfig.findUnique({ where: { key: "prize_config" } });
  if (!cfg) return new Map();
  try {
    const tiers = JSON.parse(cfg.value) as { tier: string; label: string; color: string }[];
    return new Map(tiers.map((t) => [t.tier, { label: t.label, color: t.color }]));
  } catch { return new Map(); }
}

export async function getLiveStats() {
  const eventRound = await getCurrentEventRound();
  const [total, spun, prizeStats, assignedStats, configMap] = await Promise.all([
    prisma.employee.count({ where: { role: "user" } }),
    prisma.employee.count({ where: { hasSpun: true } }),
    prisma.prize.groupBy({ by: ["tier"], _count: { id: true }, where: { eventRound } }),
    prisma.prize.groupBy({ by: ["tier"], _count: { id: true }, where: { assigned: true, eventRound } }),
    getPrizeConfigMap(),
  ]);

  const prizePool: Record<string, { total: number; assigned: number; remaining: number; label: string; color: string }> = {};
  for (const ps of prizeStats) {
    const a = assignedStats.find((p) => p.tier === ps.tier)?._count.id || 0;
    const cfg = configMap.get(ps.tier);
    prizePool[ps.tier] = {
      total: ps._count.id,
      assigned: a,
      remaining: ps._count.id - a,
      label: cfg?.label || ps.tier,
      color: cfg?.color || "#D4708F",
    };
  }

  return {
    totalParticipants: total,
    spunCount: spun,
    prizePool,
  };
}

export async function getRecentWinners(limit = 20) {
  const eventRound = await getCurrentEventRound();
  const logs = await prisma.spinLog.findMany({
    where: { eventRound },
    take: limit,
    orderBy: { spunAt: "desc" },
    include: {
      user: { select: { name: true, dept: true } },
      prize: { select: { label: true } },
    },
  });

  return logs.map((l) => ({
    name: l.user.name,
    dept: l.user.dept,
    tier: l.tier,
    value: l.value,
    label: l.prize.label || l.tier,
    isHighTier: l.tier !== "CONS",
    spunAt: l.spunAt.toISOString(),
  }));
}
