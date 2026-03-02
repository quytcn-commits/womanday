import { FastifyInstance, FastifyRequest } from "fastify";
import { submitQuizAnswer, getMegaphoneBalance, getAnsweredQuestions } from "../services/quiz.service";

export async function quizRoutes(app: FastifyInstance) {
  // POST /api/v1/quiz/answer
  app.post("/answer", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;
    const { questionId, selectedIndex } = req.body as { questionId: number; selectedIndex: number };

    if (typeof questionId !== "number" || typeof selectedIndex !== "number") {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }

    try {
      const result = await submitQuizAnswer(userId, questionId, selectedIndex);
      return reply.send(result);
    } catch (err: any) {
      if (err.message === "INVALID_QUESTION") {
        return reply.code(400).send({ error: "INVALID_QUESTION" });
      }
      throw err;
    }
  });

  // GET /api/v1/quiz/balance
  app.get("/balance", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;
    const balance = await getMegaphoneBalance(userId);
    return reply.send(balance);
  });

  // GET /api/v1/quiz/answers
  app.get("/answers", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;
    const answers = await getAnsweredQuestions(userId);
    return reply.send({ answers });
  });
}
