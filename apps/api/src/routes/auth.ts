import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { loginWithCccdDob, sanitizeEmployee } from "../services/auth.service";
import { importEmployeesFromCsv } from "../lib/csv-import";
import prisma from "../lib/prisma";

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/login
  app.post("/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const { cccd, dob } = req.body as { cccd?: string; dob?: string };

    if (!cccd || !dob) {
      return reply.code(400).send({ success: false, error: "MISSING_FIELDS", message: "Vui lòng nhập CCCD và ngày sinh" });
    }

    const result = await loginWithCccdDob(cccd.trim(), dob.trim());
    if (!result) {
      return reply.code(401).send({ success: false, error: "INVALID_CREDENTIALS", message: "CCCD hoặc ngày sinh không đúng" });
    }

    return reply.send({ success: true, token: result.token, employee: result.employee });
  });

  // POST /api/v1/auth/import-csv  (admin only, multipart)
  app.post("/import-csv", { preHandler: [app.authenticate, app.adminOnly] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ success: false, error: "NO_FILE" });

    const buffer = await data.toBuffer();
    const result = await importEmployeesFromCsv(buffer);

    return reply.send({ success: true, ...result });
  });
}
