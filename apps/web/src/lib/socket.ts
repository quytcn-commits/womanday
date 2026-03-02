"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(WS_URL, {
      auth: token ? { token } : undefined,
      query: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => console.log("[WS] Connected:", socket!.id));
    socket.on("disconnect", (reason) => console.log("[WS] Disconnected:", reason));
    socket.on("connect_error", (err) => console.error("[WS] Error:", err.message));
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
