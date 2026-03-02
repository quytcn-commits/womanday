"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";

interface ChatMsg {
  id: string;
  user: { name: string; dept: string };
  message: string;
  reactions: Record<string, number>;
  createdAt: string;
  type: string;
}

interface Props {
  socket: Socket | null;
  roomId?: string | null;
  compact?: boolean;
  myUserId?: string;
}

const REACTIONS = ["❤️", "👏", "🔥"];

export default function ChatPanel({ socket, roomId, compact, myUserId }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [megaphoneMode, setMegaphoneMode] = useState<"small" | "big" | null>(null);
  const [megaBalance, setMegaBalance] = useState({ small: 0, big: 0 });
  const [chatError, setChatError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load megaphone balance on mount
  useEffect(() => {
    apiFetch<{ megaphoneSmall: number; megaphoneBig: number }>("/api/v1/quiz/balance")
      .then((b) => setMegaBalance({ small: b.megaphoneSmall, big: b.megaphoneBig }))
      .catch(() => {});
  }, []);

  // Listen for megaphone_balance updates from socket
  useEffect(() => {
    if (!socket) return;
    const handleBalance = (data: { megaphoneSmall: number; megaphoneBig: number }) => {
      setMegaBalance({ small: data.megaphoneSmall, big: data.megaphoneBig });
    };
    socket.on("megaphone_balance", handleBalance);
    return () => { socket.off("megaphone_balance", handleBalance); };
  }, [socket]);

  useEffect(() => {
    const url = roomId
      ? `/api/v1/chat/messages?room_id=${roomId}&limit=50`
      : `/api/v1/chat/messages?limit=50`;
    apiFetch<{ messages: any[] }>(url, { auth: false })
      .then(({ messages: hist }) => {
        setMessages(
          hist.map((m) => ({
            id: m.id,
            user: { name: m.name, dept: m.dept },
            message: m.message,
            reactions: m.reactions || {},
            createdAt: m.createdAt,
            type: m.type || "chat",
          }))
        );
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
      })
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleMsg = (data: any) => {
      if (data.roomId && roomId && data.roomId !== roomId) return;
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === data.id);
        if (exists) return prev;
        return [...prev.slice(-99), { ...data, user: data.user || { name: "Hệ thống", dept: "" } }];
      });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleReaction = (data: any) => {
      setMessages((prev) =>
        prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m)
      );
    };

    const handleModeration = (data: any) => {
      if (data.action === "DELETE_MESSAGE") {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    const handleChatError = (data: any) => {
      const errMap: Record<string, string> = {
        RATE_LIMITED: "Gửi quá nhanh, đợi 3 giây",
        NO_MEGAPHONE: "Hết lượt loa",
        USER_MUTED: "Bạn đang bị tắt tiếng",
        EMPTY_MESSAGE: "Tin nhắn trống",
      };
      setChatError(errMap[data.error] || data.error || "Lỗi gửi tin");
      setTimeout(() => setChatError(""), 3000);
      // Revert optimistic balance if megaphone failed
      if (data.error === "NO_MEGAPHONE" || data.error === "RATE_LIMITED") {
        apiFetch<{ megaphoneSmall: number; megaphoneBig: number }>("/api/v1/quiz/balance")
          .then((b) => setMegaBalance({ small: b.megaphoneSmall, big: b.megaphoneBig }))
          .catch(() => {});
      }
    };

    socket.on("chat_message", handleMsg);
    socket.on("reaction_updated", handleReaction);
    socket.on("moderation_action", handleModeration);
    socket.on("chat_error", handleChatError);

    return () => {
      socket.off("chat_message", handleMsg);
      socket.off("reaction_updated", handleReaction);
      socket.off("moderation_action", handleModeration);
      socket.off("chat_error", handleChatError);
    };
  }, [socket, roomId]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit("send_chat", {
      roomId: roomId || null,
      message: input.trim(),
      megaphone: megaphoneMode,
    });
    setInput("");
    // Optimistically decrement balance
    if (megaphoneMode === "small" && megaBalance.small > 0) {
      setMegaBalance((b) => ({ ...b, small: b.small - 1 }));
    } else if (megaphoneMode === "big" && megaBalance.big > 0) {
      setMegaBalance((b) => ({ ...b, big: b.big - 1 }));
    }
    setMegaphoneMode(null);
  }

  function sendReaction(messageId: string, reaction: string) {
    socket?.emit("send_reaction", { messageId, reaction });
  }

  function toggleMegaphone(type: "small" | "big") {
    setMegaphoneMode((prev) => prev === type ? null : type);
  }

  const hasMegaphone = megaBalance.small > 0 || megaBalance.big > 0;

  return (
    <div className={`flex flex-col ${compact ? "h-64" : "h-full"}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-2 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="group"
            >
              {msg.type === "system" ? (
                <p className="text-center text-brand-deep/25 text-xs italic py-1 font-light">— {msg.message} —</p>
              ) : (
                <div
                  className={`flex gap-2 items-start ${
                    msg.type === "megaphone_big"
                      ? "bg-gradient-to-r from-brand-gold/15 to-brand-gold/5 border border-brand-gold/30 rounded-xl px-2 py-1.5"
                      : msg.type === "megaphone_small"
                      ? "bg-brand-gold/8 border border-brand-gold/15 rounded-xl px-2 py-1.5"
                      : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold" style={{
                      color: msg.type.startsWith("megaphone") ? "#C4977A" : undefined,
                    }}>
                      {msg.type === "megaphone_big" && "📣 "}
                      {msg.type === "megaphone_small" && "📢 "}
                      <span className={msg.type.startsWith("megaphone") ? "text-brand-gold" : "text-brand-hot"}>
                        {msg.user?.name?.split(" ").slice(-2).join(" ")}
                      </span>
                    </span>
                    <span className="text-brand-deep/25 text-xs font-light"> · {msg.user?.dept}</span>
                    <p className={`${compact ? "text-xs" : "text-sm"} mt-0.5 break-words font-light ${
                      msg.type === "megaphone_big"
                        ? "text-brand-gold font-semibold text-sm"
                        : msg.type === "megaphone_small"
                        ? "text-brand-gold/80 font-medium"
                        : "text-brand-deep/80"
                    }`}>{msg.message}</p>
                    {/* Reactions */}
                    {Object.keys(msg.reactions || {}).length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(msg.reactions).map(([r, count]) =>
                          count > 0 ? (
                            <button
                              key={r}
                              onClick={() => sendReaction(msg.id, r)}
                              className="text-xs bg-brand-hot/[0.08] rounded-full px-2 py-0.5 hover:bg-brand-hot/[0.15] transition-colors duration-200"
                            >
                              {r} {count}
                            </button>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                  {/* Quick reactions */}
                  <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                    {REACTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => sendReaction(msg.id, r)}
                        className="text-sm opacity-40 hover:opacity-90 transition-opacity duration-200"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Error toast */}
      {chatError && (
        <div className="mx-2 mb-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs text-center">
          {chatError}
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="p-2 border-t border-brand-hot/[0.08] mt-1">
        {/* Megaphone selector row */}
        {hasMegaphone && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-brand-deep/30 text-[10px] font-light mr-1">Loa:</span>
            {megaBalance.small > 0 && (
              <button
                type="button"
                onClick={() => toggleMegaphone("small")}
                className={`text-xs px-2 py-0.5 rounded-full transition-all duration-200 ${
                  megaphoneMode === "small"
                    ? "bg-brand-gold/20 border border-brand-gold/50 text-brand-gold font-semibold shadow-[0_0_8px_rgba(196,151,122,0.3)]"
                    : "bg-brand-deep/5 border border-brand-deep/10 text-brand-deep/50 hover:border-brand-gold/30"
                }`}
              >
                📢 x{megaBalance.small}
              </button>
            )}
            {megaBalance.big > 0 && (
              <button
                type="button"
                onClick={() => toggleMegaphone("big")}
                className={`text-xs px-2 py-0.5 rounded-full transition-all duration-200 ${
                  megaphoneMode === "big"
                    ? "bg-brand-gold/25 border border-brand-gold/60 text-brand-gold font-bold shadow-[0_0_12px_rgba(196,151,122,0.4)] animate-pulse"
                    : "bg-brand-deep/5 border border-brand-deep/10 text-brand-deep/50 hover:border-brand-gold/30"
                }`}
              >
                📣 x{megaBalance.big}
              </button>
            )}
            {megaphoneMode && (
              <span className="text-brand-gold text-[10px] font-light ml-auto">
                {megaphoneMode === "big" ? "Loa lon — hien full man hinh!" : "Loa nho — hien banner!"}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={megaphoneMode ? (megaphoneMode === "big" ? "📣 Tin nhan loa lon..." : "📢 Tin nhan loa nho...") : "Go tin nhan... (1 tin/3s)"}
            maxLength={200}
            className={`flex-1 bg-white/70 border rounded-xl px-3 py-2 text-brand-deep text-sm placeholder-brand-deep/25 focus:outline-none transition-all duration-300 font-light ${
              megaphoneMode
                ? "border-brand-gold/40 shadow-[0_0_12px_rgba(196,151,122,0.15)] focus:border-brand-gold/60 focus:shadow-[0_0_20px_rgba(196,151,122,0.2)]"
                : "border-brand-hot/15 focus:border-brand-hot/35 focus:shadow-[0_0_15px_rgba(232,96,122,0.08)]"
            }`}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className={`px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-25 transition-all duration-300 ${
              megaphoneMode
                ? "bg-brand-gold/90 text-white hover:bg-brand-gold hover:shadow-[0_0_15px_rgba(196,151,122,0.3)]"
                : "bg-brand-hot/80 text-white hover:bg-brand-hot hover:shadow-[0_0_15px_rgba(232,96,122,0.2)]"
            }`}
          >
            {megaphoneMode === "big" ? "📣" : megaphoneMode === "small" ? "📢" : "↑"}
          </button>
        </div>
      </form>
    </div>
  );
}
