import { FastifyInstance, FastifyRequest } from "fastify";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { generateCardImage, getGreeting } from "../services/image.service";
import prisma from "../lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || "3145728"); // 3MB

const TEMPLATE_NAMES: Record<number, string> = {
  1: "Hoa Anh Đào",
  2: "Hoa Hồng Vàng",
  3: "Tím Thanh Lịch",
};

export async function selfieRoutes(app: FastifyInstance) {
  // GET /api/v1/selfie/templates — returns uploaded preview URLs (if any)
  app.get("/templates", async (_req, reply) => {
    const templates = [1, 2, 3].map((id) => {
      const previewPath = path.join(UPLOAD_DIR, "templates", `card_preview_${id}.jpg`);
      const hasPreview = fs.existsSync(previewPath);
      return {
        id,
        name: TEMPLATE_NAMES[id],
        previewUrl: hasPreview ? `/uploads/templates/card_preview_${id}.jpg` : null,
      };
    });
    return reply.send({ templates });
  });

  // POST /api/v1/selfie/upload  (multipart: file + template_id)
  app.post("/upload", { preHandler: [app.authenticate] }, async (req: FastifyRequest, reply) => {
    const userId = (req.user as { id: string }).id;

    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let templateId = 1;
    let filename = "selfie.jpg";

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "file") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_SIZE) {
            return reply.code(400).send({ success: false, error: "FILE_TOO_LARGE", message: "Ảnh tối đa 3MB" });
          }
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        filename = part.filename || "selfie.jpg";
      } else if (part.type === "field" && part.fieldname === "template_id") {
        templateId = parseInt(part.value as string) || 1;
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ success: false, error: "NO_FILE", message: "Không có ảnh được tải lên" });
    }

    // Save selfie — auto-rotate from EXIF + convert to JPEG
    const selfiesDir = path.join(UPLOAD_DIR, "selfies");
    fs.mkdirSync(selfiesDir, { recursive: true });
    const selfieFilename = `${userId}.jpg`;
    const selfieLocalPath = path.join(selfiesDir, selfieFilename);
    const processedBuffer = await sharp(fileBuffer)
      .rotate()              // auto-rotate based on EXIF orientation
      .jpeg({ quality: 90 }) // normalize to JPEG
      .toBuffer();
    fs.writeFileSync(selfieLocalPath, processedBuffer);
    const selfieUrl = `/uploads/selfies/${selfieFilename}`;

    // Update employee record
    await prisma.employee.update({
      where: { id: userId },
      data: { selfieUrl, cardTemplateId: templateId },
    });

    // Generate card image async
    let cardImageUrl: string | null = null;
    try {
      const emp = await prisma.employee.findUnique({ where: { id: userId } });
      cardImageUrl = await generateCardImage({
        userId,
        name: emp!.name,
        dept: emp!.dept,
        selfieLocalPath,
        templateId,
      });
      await prisma.employee.update({ where: { id: userId }, data: { cardImageUrl } });
      // Delete existing card image record if any, then insert fresh
      await prisma.generatedImage.deleteMany({ where: { userId, type: "card" } });
      await prisma.generatedImage.create({
        data: { userId, type: "card", imageUrl: cardImageUrl },
      });
    } catch (e) {
      console.error("[Selfie] Card gen error:", e);
    }

    return reply.send({
      success: true,
      selfieUrl,
      cardImageUrl,
      greeting: getGreeting(userId),
      message: "Thiệp đã được tạo thành công",
    });
  });
}
