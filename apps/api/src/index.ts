import dotenv from "dotenv";
import path from "path";

// Load .env from monorepo root FIRST (before any other imports that read env)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { buildServer } from "./server";
import { initSocketIO } from "./websocket";
import timerService from "./services/timer.service";

const PORT = parseInt(process.env.API_PORT || "3001");
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  const app = await buildServer();

  // Attach Socket.IO to Fastify's underlying HTTP server BEFORE listen
  initSocketIO(app.server);

  // Recover timers from DB on startup
  await timerService.recoverOnStartup();

  // Start server
  await app.listen({ port: PORT, host: HOST });

  console.log(`\n🌸 WomanDay API running at http://${HOST}:${PORT}`);
  console.log(`   WebSocket: ws://${HOST}:${PORT}`);
  console.log(`   Health:    http://${HOST}:${PORT}/health\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
