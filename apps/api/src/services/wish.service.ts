import prisma from "../lib/prisma";
import { checkWishRateLimit } from "../lib/redis";
import { getIo } from "../websocket/index";

export async function sendWish(fromId: string, toId: string | null, flower: string, message: string) {
  // Rate limit
  const allowed = await checkWishRateLimit(fromId);
  if (!allowed) {
    return { error: "Bạn gửi lời chúc quá nhanh, vui lòng chờ 10 giây", code: "RATE_LIMITED" };
  }

  // Validate message
  const cleanMsg = message.trim().slice(0, 100);
  if (!cleanMsg) return { error: "Tin nhắn không được để trống", code: "EMPTY_MESSAGE" };

  // Validate flower
  const validFlowers = ["🌸", "🌹", "🌷", "🌺", "🌻", "🌼", "💐", "🪻", "🌿", "💮", "🏵️", "❀"];
  const safeFlower = validFlowers.includes(flower) ? flower : "🌸";

  // If no toId, pick a random recipient (not self)
  let recipientId = toId;
  if (!recipientId) {
    const randomUser = await prisma.employee.findFirst({
      where: { role: "user", id: { not: fromId } },
      select: { id: true },
      skip: Math.floor(Math.random() * (await prisma.employee.count({ where: { role: "user", id: { not: fromId } } }))),
    });
    if (!randomUser) return { error: "Không tìm thấy người nhận", code: "NO_RECIPIENT" };
    recipientId = randomUser.id;
  }

  // Verify recipient exists
  const recipient = await prisma.employee.findUnique({
    where: { id: recipientId },
    select: { id: true, name: true },
  });
  if (!recipient) return { error: "Người nhận không tồn tại", code: "RECIPIENT_NOT_FOUND" };

  const sender = await prisma.employee.findUnique({
    where: { id: fromId },
    select: { name: true, dept: true },
  });

  const wish = await prisma.wish.create({
    data: {
      fromId,
      toId: recipientId,
      flower: safeFlower,
      message: cleanMsg,
    },
  });

  const io = getIo();

  // Notify recipient personally
  io.to(`user:${recipientId}`).emit("wish_received", {
    event: "wish_received",
    id: wish.id,
    from: { name: sender?.name || "Ẩn danh", dept: sender?.dept || "" },
    flower: safeFlower,
    message: cleanMsg,
    createdAt: wish.createdAt.toISOString(),
  });

  // Public feed for wall
  io.to("wall").emit("wish_sent", {
    event: "wish_sent",
    id: wish.id,
    from: { name: sender?.name || "Ẩn danh" },
    to: { name: recipient.name },
    flower: safeFlower,
    message: cleanMsg,
    createdAt: wish.createdAt.toISOString(),
  });

  return { success: true, wishId: wish.id };
}

export async function getReceivedWishes(userId: string) {
  return prisma.wish.findMany({
    where: { toId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      from: { select: { name: true, dept: true } },
    },
  });
}

export async function getWishFeed(limit = 30) {
  const wishes = await prisma.wish.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      from: { select: { name: true } },
      to: { select: { name: true } },
    },
  });

  return wishes.map((w) => ({
    id: w.id,
    from: { name: w.from.name },
    to: { name: w.to.name },
    flower: w.flower,
    message: w.message,
    createdAt: w.createdAt.toISOString(),
  }));
}
