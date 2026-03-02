import prisma from "../lib/prisma";

export async function getGalleryCards(
  currentUserId: string,
  page: number,
  limit: number,
  dept: string | null
) {
  const where: any = {
    role: "user",
    cardImageUrl: { not: null },
  };
  if (dept && dept !== "all") {
    where.dept = dept;
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        dept: true,
        cardImageUrl: true,
        _count: { select: { likesReceived: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Check which ones current user has liked
  const likedSet = new Set<string>();
  if (currentUserId) {
    const myLikes = await prisma.cardLike.findMany({
      where: {
        userId: currentUserId,
        targetUserId: { in: employees.map((e) => e.id) },
      },
      select: { targetUserId: true },
    });
    myLikes.forEach((l) => likedSet.add(l.targetUserId));
  }

  const cards = employees.map((e) => ({
    userId: e.id,
    name: e.name,
    dept: e.dept,
    cardImageUrl: e.cardImageUrl,
    likeCount: e._count.likesReceived,
    isLikedByMe: likedSet.has(e.id),
  }));

  return { cards, total, page, totalPages: Math.ceil(total / limit) };
}

export async function toggleLike(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    return { error: "Không thể tự like", code: "SELF_LIKE" };
  }

  // Check existing
  const existing = await prisma.cardLike.findUnique({
    where: { userId_targetUserId: { userId, targetUserId } },
  });

  if (existing) {
    await prisma.cardLike.delete({ where: { id: existing.id } });
    const count = await prisma.cardLike.count({ where: { targetUserId } });
    return { liked: false, likeCount: count };
  } else {
    await prisma.cardLike.create({ data: { userId, targetUserId } });
    const count = await prisma.cardLike.count({ where: { targetUserId } });
    return { liked: true, likeCount: count };
  }
}

export async function getDepartments() {
  const depts = await prisma.employee.groupBy({
    by: ["dept"],
    where: { role: "user", cardImageUrl: { not: null } },
    _count: { id: true },
    orderBy: { dept: "asc" },
  });
  return depts.map((d) => ({ dept: d.dept, count: d._count.id }));
}
