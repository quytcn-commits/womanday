import { FastifyInstance, FastifyRequest } from "fastify";
import { getGalleryCards, toggleLike, getDepartments } from "../services/gallery.service";

export async function galleryRoutes(app: FastifyInstance) {
  // GET /api/v1/gallery?page=1&limit=20&dept=all — auth required
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest<{ Querystring: { page?: string; limit?: string; dept?: string } }>, reply) => {
      const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 50);
      const dept = req.query.dept || null;

      const data = await getGalleryCards((req as any).user.id, page, limit, dept);
      return reply.send(data);
    }
  );

  // GET /api/v1/gallery/departments — auth required
  app.get("/departments", { preHandler: [app.authenticate] }, async (_req, reply) => {
    const depts = await getDepartments();
    return reply.send({ departments: depts });
  });

  // POST /api/v1/gallery/:userId/like — auth required, toggle
  app.post(
    "/:userId/like",
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest<{ Params: { userId: string } }>, reply) => {
      const result = await toggleLike((req as any).user.id, req.params.userId);
      if ("error" in result) {
        return reply.code(400).send({ error: result.code, message: result.error });
      }
      return reply.send(result);
    }
  );
}
