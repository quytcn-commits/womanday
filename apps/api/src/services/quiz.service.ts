import prisma from "../lib/prisma";
import { QUIZ_ANSWER_KEY } from "../lib/quizAnswers";

export async function submitQuizAnswer(
  userId: string,
  questionId: number,
  selectedIndex: number
): Promise<{
  isCorrect: boolean;
  megaphoneSmall: number;
  megaphoneBig: number;
  flowerBalance: number;
  newBigMegaphone: boolean;
  alreadyAnswered?: boolean;
}> {
  const correctIndex = QUIZ_ANSWER_KEY[questionId];
  if (correctIndex === undefined) {
    throw new Error("INVALID_QUESTION");
  }

  // Idempotent: return existing result if already answered
  const existing = await prisma.quizAnswer.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (existing) {
    const emp = await prisma.employee.findUnique({
      where: { id: userId },
      select: { megaphoneSmall: true, megaphoneBig: true, flowerBalance: true },
    });
    return {
      isCorrect: existing.isCorrect,
      megaphoneSmall: emp?.megaphoneSmall || 0,
      megaphoneBig: emp?.megaphoneBig || 0,
      flowerBalance: emp?.flowerBalance || 0,
      newBigMegaphone: false,
      alreadyAnswered: true,
    };
  }

  const isCorrect = selectedIndex === correctIndex;

  const result = await prisma.$transaction(async (tx) => {
    await tx.quizAnswer.create({
      data: { userId, questionId, selectedIndex, isCorrect },
    });

    if (!isCorrect) {
      const emp = await tx.employee.findUnique({
        where: { id: userId },
        select: { megaphoneSmall: true, megaphoneBig: true, flowerBalance: true },
      });
      return { megaphoneSmall: emp?.megaphoneSmall || 0, megaphoneBig: emp?.megaphoneBig || 0, flowerBalance: emp?.flowerBalance || 0, newBigMegaphone: false };
    }

    // Correct: increment small megaphone + flower
    const emp = await tx.employee.update({
      where: { id: userId },
      data: { megaphoneSmall: { increment: 1 }, flowerBalance: { increment: 1 } },
    });

    // Convert 3 small -> 1 big
    if (emp.megaphoneSmall >= 3) {
      const updated = await tx.employee.update({
        where: { id: userId },
        data: { megaphoneSmall: { decrement: 3 }, megaphoneBig: { increment: 1 } },
      });
      return { megaphoneSmall: updated.megaphoneSmall, megaphoneBig: updated.megaphoneBig, flowerBalance: updated.flowerBalance, newBigMegaphone: true };
    }

    return { megaphoneSmall: emp.megaphoneSmall, megaphoneBig: emp.megaphoneBig, flowerBalance: emp.flowerBalance, newBigMegaphone: false };
  });

  return { isCorrect, ...result };
}

export async function getMegaphoneBalance(userId: string) {
  const emp = await prisma.employee.findUnique({
    where: { id: userId },
    select: { megaphoneSmall: true, megaphoneBig: true, flowerBalance: true },
  });
  return { megaphoneSmall: emp?.megaphoneSmall || 0, megaphoneBig: emp?.megaphoneBig || 0, flowerBalance: emp?.flowerBalance || 0 };
}

export async function getAnsweredQuestions(userId: string) {
  return prisma.quizAnswer.findMany({
    where: { userId },
    select: { questionId: true, isCorrect: true },
  });
}
