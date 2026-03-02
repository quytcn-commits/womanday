import prisma from "../lib/prisma";
import { checkChatRateLimit } from "../lib/redis";

const ALLOWED_REACTIONS = ["❤️", "👏", "🔥"];
const MAX_MSG_LENGTH = 300;

function sanitizeMessage(msg: string): string {
  return msg
    .replace(/<[^>]*>/g, "") // strip HTML
    .trim()
    .slice(0, MAX_MSG_LENGTH);
}

export async function sendChatMessage(
  userId: string,
  message: string,
  roomId: string | null,
  megaphone: "small" | "big" | null = null
): Promise<{ id: string; megaphone: "small" | "big" | null } | { error: string; code: number }> {
  // Rate limit check
  const allowed = await checkChatRateLimit(userId);
  if (!allowed) {
    return { error: "RATE_LIMITED", code: 429 };
  }

  // Check mute
  const employee = await prisma.employee.findUnique({ where: { id: userId } });
  if (!employee) return { error: "NOT_FOUND", code: 404 };
  if (employee.isMuted && employee.mutedUntil && employee.mutedUntil > new Date()) {
    return { error: "USER_MUTED", code: 403 };
  }

  // Validate and consume megaphone token
  if (megaphone === "small" && employee.megaphoneSmall < 1) {
    return { error: "NO_MEGAPHONE", code: 400 };
  }
  if (megaphone === "big" && employee.megaphoneBig < 1) {
    return { error: "NO_MEGAPHONE", code: 400 };
  }

  if (megaphone === "small") {
    await prisma.employee.update({ where: { id: userId }, data: { megaphoneSmall: { decrement: 1 } } });
  } else if (megaphone === "big") {
    await prisma.employee.update({ where: { id: userId }, data: { megaphoneBig: { decrement: 1 } } });
  }

  const clean = sanitizeMessage(message);
  if (!clean) return { error: "EMPTY_MESSAGE", code: 400 };

  const type = megaphone === "big" ? "megaphone_big" : megaphone === "small" ? "megaphone_small" : "user";

  const chat = await prisma.chatMessage.create({
    data: {
      userId,
      roomId,
      message: clean,
      type,
      reactions: {},
    },
  });

  return { id: chat.id, megaphone };
}

export async function addReaction(
  messageId: string,
  reaction: string
): Promise<Record<string, number> | null> {
  if (!ALLOWED_REACTIONS.includes(reaction)) return null;

  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.deletedAt) return null;

  const reactions = (msg.reactions as Record<string, number>) || {};
  reactions[reaction] = (reactions[reaction] || 0) + 1;

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { reactions },
  });

  return reactions;
}

export async function deleteMessage(messageId: string, adminId: string) {
  return prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), deletedBy: adminId },
  });
}

export async function muteUser(userId: string, durationMinutes: number) {
  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  return prisma.employee.update({
    where: { id: userId },
    data: { isMuted: true, mutedUntil },
  });
}

export async function getRecentMessages(roomId: string | null, limit = 50) {
  return prisma.chatMessage.findMany({
    where: { roomId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, dept: true } } },
  });
}
