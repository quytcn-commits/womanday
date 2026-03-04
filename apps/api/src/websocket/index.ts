import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { verifyToken } from "../services/auth.service";
import { sendChatMessage, addReaction, deleteMessage, muteUser } from "../services/chat.service";
import prisma from "../lib/prisma";

let io: SocketServer;

// ── In-memory state for viewers & flowers ──────────────────
const roomViewers = new Map<string, Set<string>>();        // roomId → Set<socketId>
const roomFlowers = new Map<string, Map<number, number>>(); // roomId → Map<slotIndex, flowerCount>
const viewerBonusGiven = new Map<string, Set<string>>();    // roomId → Set<userId> (prevent double bonus)

function getFlowerState(roomId: string): Record<number, number> {
  const fm = roomFlowers.get(roomId);
  if (!fm) return {};
  const out: Record<number, number> = {};
  fm.forEach((v, k) => { out[k] = v; });
  return out;
}

function cleanupRoom(roomId: string) {
  roomViewers.delete(roomId);
  roomFlowers.delete(roomId);
  viewerBonusGiven.delete(roomId);
}

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // Allow anonymous for /wall viewers
      socket.data.userId = null;
      socket.data.role = "viewer";
      return next();
    }
    const payload = verifyToken(token as string);
    if (!payload) return next(new Error("Invalid token"));
    socket.data.userId = payload.id;
    socket.data.name = payload.name;
    socket.data.dept = payload.dept;
    socket.data.role = payload.role;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string | null;
    if (userId) {
      // Join personal channel
      socket.join(`user:${userId}`);
    }

    // ── Room Events ──────────────────────────────────────────
    socket.on("join_room", (data: { roomId: string }) => {
      if (data?.roomId) {
        socket.join(`room:${data.roomId}`);
      }
    });

    socket.on("leave_room", (data: { roomId: string }) => {
      if (data?.roomId) socket.leave(`room:${data.roomId}`);
    });

    // ── Viewer Mode ──────────────────────────────────────────
    socket.on("join_room_viewer", async (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const roomId = data.roomId;

      // Join socket room
      socket.join(`room:${roomId}`);

      // Track viewer
      if (!roomViewers.has(roomId)) roomViewers.set(roomId, new Set());
      roomViewers.get(roomId)!.add(socket.id);

      // Emit viewer count
      io.to(`room:${roomId}`).emit("viewer_count", {
        roomId,
        count: roomViewers.get(roomId)!.size,
      });

      // Send current flower state
      socket.emit("flower_state", { roomId, flowers: getFlowerState(roomId) });

      // Give +1 flower bonus (once per user per room)
      if (userId) {
        if (!viewerBonusGiven.has(roomId)) viewerBonusGiven.set(roomId, new Set());
        const bonusSet = viewerBonusGiven.get(roomId)!;
        if (!bonusSet.has(userId)) {
          bonusSet.add(userId);
          try {
            const emp = await prisma.employee.update({
              where: { id: userId },
              data: { flowerBalance: { increment: 1 } },
            });
            socket.emit("flower_balance", { flowerBalance: emp.flowerBalance });
          } catch {}
        } else {
          // Already got bonus, just send current balance
          try {
            const emp = await prisma.employee.findUnique({
              where: { id: userId },
              select: { flowerBalance: true },
            });
            socket.emit("flower_balance", { flowerBalance: emp?.flowerBalance || 0 });
          } catch {}
        }
      }
    });

    // ── Flower Events ────────────────────────────────────────
    socket.on("send_flower", async (data: { roomId: string; slotIndex: number }) => {
      if (!userId || !data?.roomId || !data?.slotIndex) return;

      try {
        // Decrement flower balance (atomic, check >= 1)
        const emp = await prisma.employee.findUnique({ where: { id: userId }, select: { flowerBalance: true } });
        if (!emp || emp.flowerBalance < 1) {
          return socket.emit("flower_error", { error: "NO_FLOWERS" });
        }

        const updated = await prisma.employee.update({
          where: { id: userId },
          data: { flowerBalance: { decrement: 1 } },
        });

        // Increment in-memory flower count
        const roomId = data.roomId;
        if (!roomFlowers.has(roomId)) roomFlowers.set(roomId, new Map());
        const fm = roomFlowers.get(roomId)!;
        fm.set(data.slotIndex, (fm.get(data.slotIndex) || 0) + 1);

        const totalFlowers = fm.get(data.slotIndex)!;

        // Broadcast to room + wall
        const payload = {
          roomId,
          slotIndex: data.slotIndex,
          fromUser: { name: socket.data.name, dept: socket.data.dept },
          totalFlowers,
        };
        io.to(`room:${roomId}`).emit("flower_received", payload);
        io.to("wall").emit("flower_received", payload);

        // Send updated balance to sender
        socket.emit("flower_balance", { flowerBalance: updated.flowerBalance });
      } catch {
        // Ignore errors
      }
    });

    // ── Event Channel (auto-follow active room) ──────────────
    socket.on("join_event", async () => {
      socket.join("event");
      try {
        const { getActiveRoom } = await import("../services/event.service");
        const active = await getActiveRoom();
        if (active) {
          socket.emit("active_room_changed", {
            event: "active_room_changed",
            roomId: active.roomId,
            status: active.status,
          });
          // Also join room channel for real-time updates
          socket.join(`room:${active.roomId}`);
        }
      } catch {
        // Non-critical
      }
    });

    socket.on("leave_event", () => {
      socket.leave("event");
    });

    // Wall viewer subscribes to all rooms
    socket.on("watch_all", async () => {
      socket.join("wall");
      // Send current active room state so wall doesn't miss rooms created before it connected
      try {
        const activeRoom = await prisma.room.findFirst({
          where: { status: { notIn: ["DONE"] } },
          orderBy: { createdAt: "desc" },
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, dept: true, selfieUrl: true, cardImageUrl: true } } },
              orderBy: { slotIndex: "asc" },
            },
          },
        });
        if (activeRoom) {
          const BASE = process.env.CORS_ORIGIN || "http://localhost:3000";
          socket.emit("room_created", {
            roomId: activeRoom.id,
            qrUrl: `${BASE}/join?room=${activeRoom.id}`,
          });
          // If room has participants, sync them
          for (const p of activeRoom.participants) {
            socket.emit("participant_joined", {
              roomId: activeRoom.id,
              slotIndex: p.slotIndex,
              participantCount: activeRoom.participants.length,
              participant: {
                userId: p.userId,
                name: p.user.name,
                dept: p.user.dept,
                selfieUrl: p.user.selfieUrl,
                cardImageUrl: p.user.cardImageUrl,
                state: p.state,
              },
            });
          }
          // Emit current status if not CREATED
          if (activeRoom.status !== "CREATED" && activeRoom.status !== "WAITING") {
            socket.emit("room_status_sync", { roomId: activeRoom.id, status: activeRoom.status });
          }
          // Send flower state for active room
          socket.emit("flower_state", { roomId: activeRoom.id, flowers: getFlowerState(activeRoom.id) });
        }
      } catch (e) {
        // Non-critical, ignore
      }
    });

    // ── Chat Events ──────────────────────────────────────────
    socket.on("send_chat", async (data: { roomId: string | null; message: string; megaphone?: "small" | "big" | null }) => {
      if (!userId) return socket.emit("error", { message: "Chưa đăng nhập" });
      if (!data?.message) return;

      const megaphone = data.megaphone || null;
      console.log("[Chat] send_chat:", { userId, megaphone, msg: data.message?.slice(0, 30) });
      const result = await sendChatMessage(userId, data.message, data.roomId || null, megaphone);
      if ("error" in result) {
        console.log("[Chat] ERROR:", result);
        return socket.emit("chat_error", { error: result.error, code: result.code });
      }

      const msgType = result.megaphone === "big" ? "megaphone_big"
                     : result.megaphone === "small" ? "megaphone_small" : "user";

      const chatPayload = {
        event: "chat_message",
        id: result.id,
        roomId: data.roomId || null,
        user: { userId, name: socket.data.name, dept: socket.data.dept },
        message: data.message.trim().replace(/<[^>]*>/g, "").slice(0, 300),
        type: msgType,
        reactions: {},
        createdAt: new Date().toISOString(),
      };

      if (data.roomId) {
        io.to(`room:${data.roomId}`).emit("chat_message", chatPayload);
      } else {
        io.emit("chat_message", chatPayload);
      }
      io.to("wall").emit("chat_message", chatPayload);

      // Megaphone: emit full-screen announcement + updated balance
      console.log("[Chat] result.megaphone:", result.megaphone);
      if (result.megaphone) {
        console.log("[Chat] EMITTING megaphone_announcement!");
        const announcementPayload = {
          event: "megaphone_announcement",
          id: result.id,
          megaphoneType: result.megaphone,
          user: { userId, name: socket.data.name, dept: socket.data.dept },
          message: data.message.trim().replace(/<[^>]*>/g, "").slice(0, 300),
          createdAt: new Date().toISOString(),
        };
        io.to("wall").emit("megaphone_announcement", announcementPayload);
        io.emit("megaphone_announcement", announcementPayload);

        const emp = await prisma.employee.findUnique({
          where: { id: userId },
          select: { megaphoneSmall: true, megaphoneBig: true },
        });
        socket.emit("megaphone_balance", {
          megaphoneSmall: emp?.megaphoneSmall || 0,
          megaphoneBig: emp?.megaphoneBig || 0,
        });
      }
    });

    socket.on("send_reaction", async (data: { messageId: string; reaction: string }) => {
      if (!data?.messageId || !data?.reaction) return;
      const reactions = await addReaction(data.messageId, data.reaction);
      if (reactions) {
        io.emit("reaction_updated", {
          event: "reaction_updated",
          messageId: data.messageId,
          reactions,
        });
      }
    });

    // ── Admin Events ─────────────────────────────────────────
    socket.on("admin_delete_msg", async (data: { messageId: string }) => {
      if (socket.data.role !== "admin") return;
      if (!data?.messageId) return;
      await deleteMessage(data.messageId, userId!);
      io.emit("moderation_action", {
        event: "moderation_action",
        action: "DELETE_MESSAGE",
        messageId: data.messageId,
      });
    });

    socket.on("admin_mute_user", async (data: { userId: string; durationMinutes: number }) => {
      if (socket.data.role !== "admin") return;
      await muteUser(data.userId, data.durationMinutes || 10);
      io.emit("moderation_action", {
        event: "moderation_action",
        action: "MUTE_USER",
        userId: data.userId,
      });
    });

    socket.on("disconnect", () => {
      // Remove from viewer tracking
      roomViewers.forEach((viewers, roomId) => {
        if (viewers.delete(socket.id)) {
          io.to(`room:${roomId}`).emit("viewer_count", {
            roomId,
            count: viewers.size,
          });
        }
      });
    });
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

// Export cleanup for use by room service when room transitions to DONE
export function cleanupRoomState(roomId: string) {
  cleanupRoom(roomId);
}
