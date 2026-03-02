import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import jwt from "@fastify/jwt";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// Ensure upload directories exist
["selfies", "cards", "results", "templates"].forEach((d) =>
  fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true })
);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "development" ? "info" : "warn",
    },
  });

  // ── CORS ──────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.CORS_ORIGIN || "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
  ];
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, mobile apps, same-origin)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Also allow any request from the same LAN subnet (192.168.x.x)
      if (/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // ── JWT ───────────────────────────────────────────────────
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "womandayspin2026",
  });

  // ── Multipart (file upload) ───────────────────────────────
  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || "15728640"), // 15MB for template uploads
    },
  });

  // ── Static files (uploads) ────────────────────────────────
  await app.register(staticFiles, {
    root: path.resolve(UPLOAD_DIR),
    prefix: "/uploads/",
  });

  // ── Auth decorators ───────────────────────────────────────
  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED", message: "Vui lòng đăng nhập" });
    }
  });

  app.decorate("adminOnly", async (req: any, reply: any) => {
    if (req.user?.role !== "admin") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Chỉ admin mới có quyền này" });
    }
  });

  // ── Routes ────────────────────────────────────────────────
  const { authRoutes } = await import("./routes/auth");
  const { meRoutes } = await import("./routes/me");
  const { selfieRoutes } = await import("./routes/selfie");
  const { roomRoutes } = await import("./routes/rooms");
  const { adminRoutes } = await import("./routes/admin");
  const { chatRoutes } = await import("./routes/chat");
  const { resultRoutes } = await import("./routes/result");
  const { statsRoutes } = await import("./routes/stats");
  const { wishRoutes } = await import("./routes/wishes");
  const { galleryRoutes } = await import("./routes/gallery");
  const { quizRoutes } = await import("./routes/quiz");
  const { eventRoutes } = await import("./routes/event");

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(meRoutes, { prefix: "/api/v1/me" });
  app.register(selfieRoutes, { prefix: "/api/v1/selfie" });
  app.register(roomRoutes, { prefix: "/api/v1/rooms" });
  app.register(adminRoutes, { prefix: "/api/v1/admin" });
  app.register(chatRoutes, { prefix: "/api/v1/chat" });
  app.register(resultRoutes, { prefix: "/api/v1/result" });
  app.register(statsRoutes, { prefix: "/api/v1/stats" });
  app.register(wishRoutes, { prefix: "/api/v1/wishes" });
  app.register(galleryRoutes, { prefix: "/api/v1/gallery" });
  app.register(quizRoutes, { prefix: "/api/v1/quiz" });
  app.register(eventRoutes, { prefix: "/api/v1/event" });

  // ── Health check ──────────────────────────────────────────
  app.get("/health", async () => ({ status: "ok", time: new Date().toISOString() }));

  // ── Type augmentation ─────────────────────────────────────
  app.addHook("onReady", () => {
    console.log("[Server] Ready");
  });

  return app;
}
