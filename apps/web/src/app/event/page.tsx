"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { getToken, getUser, updateUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import RoomGrid from "@/components/RoomGrid";
import CountdownTimer from "@/components/CountdownTimer";
import SpinAnimation from "@/components/SpinAnimation";
import MiniQuiz from "@/components/MiniQuiz";
import ChatPanel from "@/components/ChatPanel";
import FlowerAnimation from "@/components/FlowerAnimation";
import MegaphoneOverlay from "@/components/MegaphoneOverlay";
import type { RoomStatus, PrizeTier } from "@womanday/types";

type PageState = "IDLE" | "JOINING" | "IN_ROOM" | "VIEWER";

interface RoomData {
  id: string;
  status: string;
  participantCount: number;
  participants: any[];
}

export default function EventPage() {
  const router = useRouter();
  const user = getUser();

  // Page state
  const [pageState, setPageState] = useState<PageState>("IDLE");
  const [eventName, setEventName] = useState("WomanDay Spin 8/3");
  const [eventStatus, setEventStatus] = useState("PENDING");
  const [error, setError] = useState("");

  // Room state
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [status, setStatus] = useState<RoomStatus>("CREATED");
  const [countdown, setCountdown] = useState(30);
  const [isSpinning, setIsSpinning] = useState(false);
  const [revealedSlots, setRevealedSlots] = useState(new Set<number>());
  const [results, setResults] = useState<Record<number, { tier: string; value: number; label: string }>>({});
  const [myResult, setMyResult] = useState<{ tier: PrizeTier; value: number; label: string } | null>(null);

  // Viewer state
  const [flowerBalance, setFlowerBalance] = useState(0);
  const [flowerCounts, setFlowerCounts] = useState<Record<number, number>>({});
  const [viewerCount, setViewerCount] = useState(0);
  const [switching, setSwitching] = useState(false);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const pageStateRef = useRef<PageState>("IDLE");

  // Keep refs in sync
  useEffect(() => { currentRoomRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { pageStateRef.current = pageState; }, [pageState]);

  // ── Switch to a different room (for viewer mode) ──
  const switchToRoom = useCallback(async (newRoomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Leave old room channel
    if (currentRoomRef.current) {
      socket.emit("leave_room", { roomId: currentRoomRef.current });
    }

    // Reset room state
    setSwitching(true);
    setRevealedSlots(new Set());
    setResults({});
    setFlowerCounts({});
    setIsSpinning(false);

    // Join new room
    setCurrentRoomId(newRoomId);
    socket.emit("join_room", { roomId: newRoomId });
    socket.emit("join_room_viewer", { roomId: newRoomId });

    // Fetch room data
    try {
      const roomData = await apiFetch<RoomData>(`/api/v1/rooms/${newRoomId}`);
      setRoom(roomData);
      setStatus(roomData.status as RoomStatus);
    } catch {
      // Will get updates via socket
    }
    setSwitching(false);
  }, []);

  // ── Bootstrap ──
  useEffect(() => {
    if (!user) { router.push("/login"); return; }

    // Fetch event info
    apiFetch<{ eventName: string; eventStatus: string }>("/api/v1/event/info")
      .then((info) => {
        setEventName(info.eventName);
        setEventStatus(info.eventStatus);
      })
      .catch(() => setError("Không thể tải thông tin sự kiện"));

    // Fetch flower balance
    apiFetch<{ flowerBalance: number }>("/api/v1/quiz/balance")
      .then((b) => setFlowerBalance(b.flowerBalance))
      .catch(() => {});

    // Auto-viewer if already spun
    if (user.hasSpun) {
      setPageState("VIEWER");
    }

    // Setup socket
    const token = getToken();
    const socket = getSocket(token || undefined);
    socketRef.current = socket;
    socket.emit("join_event");

    // ── Room events ──
    socket.on("participant_joined", (data: any) => {
      if (data.roomId !== currentRoomRef.current) return;
      setRoom((prev) => {
        if (!prev || prev.id !== data.roomId) return prev;
        const updated = [...prev.participants];
        const idx = updated.findIndex((p: any) => p.slotIndex === data.slotIndex);
        if (idx >= 0) {
          updated[idx] = { ...data.participant, slotIndex: data.slotIndex, state: "JOINED" };
        }
        return { ...prev, participants: updated, participantCount: data.participantCount };
      });
    });

    socket.on("room_locked", (data: any) => {
      if (data.roomId === currentRoomRef.current) setStatus("LOCKED");
    });

    socket.on("countdown_started", (data: any) => {
      if (data.roomId === currentRoomRef.current) {
        setStatus("COUNTDOWN");
        setCountdown(data.remainingSeconds);
      }
    });

    socket.on("countdown_tick", (data: any) => {
      if (data.roomId === currentRoomRef.current) setCountdown(data.remainingSeconds);
    });

    socket.on("spin_started", (data: any) => {
      if (data.roomId === currentRoomRef.current) {
        setStatus("SPINNING");
        setIsSpinning(true);
      }
    });

    socket.on("reveal_result", (data: any) => {
      if (data.roomId !== currentRoomRef.current) return;
      setRevealedSlots((prev) => new Set([...prev, data.slotIndex]));
      setResults((prev) => ({ ...prev, [data.slotIndex]: data.prize }));
      if (data.user.userId === user.id) {
        setMyResult(data.prize);
      }
    });

    socket.on("room_results_ready", (data: any) => {
      if (data.roomId !== currentRoomRef.current) return;
      setStatus("DONE");
      setIsSpinning(false);

      if (pageStateRef.current === "IN_ROOM") {
        // Participant: mark as spun, transition to VIEWER after delay
        updateUser({ hasSpun: true });
        setTimeout(() => {
          setPageState("VIEWER");
        }, 5000);
      }
    });

    // ── Flower events ──
    socket.on("flower_received", (data: any) => {
      if (data.roomId === currentRoomRef.current) {
        setFlowerCounts((prev) => ({ ...prev, [data.slotIndex]: data.totalFlowers }));
      }
    });

    socket.on("flower_balance", (data: any) => {
      setFlowerBalance(data.flowerBalance);
    });

    socket.on("flower_state", (data: any) => {
      if (data.roomId === currentRoomRef.current) setFlowerCounts(data.flowers || {});
    });

    socket.on("viewer_count", (data: any) => {
      if (data.roomId === currentRoomRef.current) setViewerCount(data.count);
    });

    // ── Event-level: active room changed ──
    socket.on("active_room_changed", (data: { roomId: string | null; status: string }) => {
      // Only auto-switch in VIEWER mode
      if (pageStateRef.current !== "VIEWER") return;
      if (!data.roomId) {
        setRoom(null);
        setCurrentRoomId(null);
        return;
      }
      if (data.roomId !== currentRoomRef.current) {
        switchToRoom(data.roomId);
      }
    });

    return () => {
      socket.off("participant_joined");
      socket.off("room_locked");
      socket.off("countdown_started");
      socket.off("countdown_tick");
      socket.off("spin_started");
      socket.off("reveal_result");
      socket.off("room_results_ready");
      socket.off("flower_received");
      socket.off("flower_balance");
      socket.off("flower_state");
      socket.off("viewer_count");
      socket.off("active_room_changed");
    };
  }, [router, switchToRoom]);

  // ── Viewer init: fetch active room ──
  useEffect(() => {
    if (pageState === "VIEWER" && !currentRoomId) {
      apiFetch<{ activeRoom: RoomData | null }>("/api/v1/event/active-room")
        .then((res) => {
          if (res.activeRoom) {
            switchToRoom(res.activeRoom.id);
          }
        })
        .catch(() => {});
    }
  }, [pageState, currentRoomId, switchToRoom]);

  // ── Join event action ──
  async function handleJoinEvent() {
    setPageState("JOINING");
    setError("");
    try {
      const res = await apiFetch<{ success: boolean; roomId: string; slotIndex: number }>(
        "/api/v1/event/join",
        { method: "POST" }
      );
      setCurrentRoomId(res.roomId);
      setMySlot(res.slotIndex);
      setPageState("IN_ROOM");

      // Join socket room
      socketRef.current?.emit("join_room", { roomId: res.roomId });

      // Fetch full room data
      const roomData = await apiFetch<RoomData>(`/api/v1/rooms/${res.roomId}`);
      setRoom(roomData);
      setStatus(roomData.status as RoomStatus);
    } catch (err: any) {
      const errCode = err.data?.error;
      if (errCode === "ALREADY_SPUN") {
        setPageState("VIEWER");
        return;
      }
      if (err.code === 401) { router.push("/login"); return; }
      setError(err.data?.message || "Không thể tham gia sự kiện");
      setPageState("IDLE");
    }
  }

  // ── Send flower ──
  function handleSendFlower(slotIndex: number) {
    if (!currentRoomId || flowerBalance < 1) return;
    socketRef.current?.emit("send_flower", { roomId: currentRoomId, slotIndex });
    setFlowerBalance((b) => Math.max(0, b - 1));
  }

  if (!user) return null;

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  // ── IDLE: Event landing ──
  if (pageState === "IDLE") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-brand-pink relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-brand-blush/50 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="text-6xl mb-4">🌸</div>
            <h1 className="text-2xl font-black text-brand-deep tracking-wider">{eventName}</h1>
            <p className="text-brand-hot italic font-light">Xin chao, {user.name}</p>
          </motion.div>

          {eventStatus !== "RUNNING" ? (
            <div className="glass p-6 text-center">
              <div className="text-4xl mb-3 animate-breathe">🕐</div>
              <p className="text-brand-deep/60 font-light">Su kien chua bat dau</p>
              <p className="text-brand-deep/35 text-xs mt-1">Vui long cho admin bat dau su kien</p>
            </div>
          ) : (
            <motion.button
              onClick={handleJoinEvent}
              whileTap={{ scale: 0.97 }}
              className="w-full bg-gradient-to-r from-brand-hot via-brand-rose to-brand-mauve text-white font-black py-4 rounded-2xl hover:shadow-[0_0_35px_rgba(232,96,122,0.3)] hover:scale-[1.02] transition-all duration-300 text-lg"
            >
              THAM GIA QUAY THUONG
            </motion.button>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={() => router.push("/ready")}
            className="text-brand-deep/30 text-xs font-light hover:text-brand-deep/60 transition-colors"
          >
            Quay lai trang chinh
          </button>
        </div>
      </div>
    );
  }

  // ── JOINING: Loading ──
  if (pageState === "JOINING") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-pink">
        <div className="text-center space-y-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="text-5xl"
          >
            🌸
          </motion.div>
          <p className="text-brand-deep/50 font-light">Dang tim phong...</p>
        </div>
      </div>
    );
  }

  // ── IN_ROOM + VIEWER: Room view ──
  const isViewer = pageState === "VIEWER";
  const currentStatus = status;
  const showChat = isViewer || (currentStatus === "WAITING" || currentStatus === "CREATED");

  return (
    <div className="min-h-screen flex flex-col items-center bg-brand-pink relative overflow-hidden">
      <SpinAnimation isSpinning={isSpinning} />
      {isViewer && <FlowerAnimation socket={socketRef.current} />}
      <MegaphoneOverlay socket={socketRef.current} />

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/20 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-brand-blush/50 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col min-h-screen px-4 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <div>
            <h1 className="text-brand-deep font-black text-lg tracking-wider uppercase">
              {room ? `Phòng #${room.id}` : eventName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={currentStatus} />
              {isViewer && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-gold/20 text-brand-gold">
                  Khán giả
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
            {room && (
              <p className="text-brand-hot font-black text-xl leading-none">
                {room.participantCount}<span className="text-brand-deep/25 text-sm font-normal">/12</span>
              </p>
            )}
            {viewerCount > 0 && (
              <p className="text-brand-deep/35 text-[10px] font-light">👁 {viewerCount} khán giả</p>
            )}
            {flowerBalance > 0 && (
              <p className="text-brand-gold text-xs font-semibold">🌸 x{flowerBalance}</p>
            )}
          </div>
        </div>

        {/* Switching room overlay */}
        <AnimatePresence>
          {switching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass px-4 py-3 text-center mb-3"
            >
              <motion.p
                className="text-brand-gold font-semibold text-sm"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                Đang chuyển phòng...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown banner */}
        <AnimatePresence>
          {currentStatus === "COUNTDOWN" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3"
            >
              <div className="glass px-4 py-2 text-center">
                <CountdownTimer seconds={countdown} label="Quay sau" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room Grid */}
        {room ? (
          <div className="flex-1 py-2">
            <RoomGrid
              participants={room.participants}
              status={currentStatus as any}
              revealedSlots={revealedSlots}
              results={results}
              mySlot={mySlot}
              flowerCounts={flowerCounts}
              onSendFlower={isViewer ? handleSendFlower : undefined}
              canSendFlower={isViewer && flowerBalance > 0}
            />
          </div>
        ) : isViewer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4 animate-breathe">🌸</div>
            <p className="text-brand-deep/50 font-light">Đang chờ phòng tiếp theo...</p>
            <p className="text-brand-deep/30 text-xs mt-1">Sẽ tự động hiện khi có phòng mới</p>
          </div>
        ) : null}

        {/* Bottom section */}
        <div className="pb-6 pt-2 space-y-2">
          {/* My result (participant only) */}
          <AnimatePresence>
            {myResult && pageState === "IN_ROOM" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="glass p-4 text-center border border-brand-gold/30"
              >
                <div className="text-4xl mb-1">
                  {myResult.tier === "FIRST" ? "🌟" : myResult.tier === "SECOND" ? "✨" : myResult.tier === "THIRD" ? "🌸" : "💐"}
                </div>
                <p className="text-brand-deep font-bold">{myResult.label}</p>
                <p className="text-brand-deep/40 text-xs mt-1 font-light">Bạn sẽ thành khán giả trong giây lát...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Viewer: my previous result mini badge */}
          {isViewer && myResult && (
            <div className="glass px-3 py-2 flex items-center justify-between">
              <span className="text-brand-deep/50 text-xs font-light">Kết quả của bạn:</span>
              <span className="text-brand-gold text-sm font-bold">
                {myResult.tier === "FIRST" ? "🌟" : myResult.tier === "SECOND" ? "✨" : myResult.tier === "THIRD" ? "🌸" : "💐"} {myResult.label}
              </span>
            </div>
          )}

          {/* Waiting: quiz + chat */}
          {showChat && room && (
            <div className="space-y-3">
              {!isViewer && mySlot && (currentStatus === "WAITING" || currentStatus === "CREATED") && (
                <div className="glass px-4 py-3 text-center">
                  <p className="text-brand-hot font-semibold text-sm">Bạn đã vào phòng — Slot #{mySlot}</p>
                  <p className="text-brand-deep/35 text-xs mt-0.5 font-light">Đang chờ phòng bắt đầu...</p>
                </div>
              )}
              {isViewer && (currentStatus === "WAITING" || currentStatus === "CREATED") && (
                <div className="glass px-4 py-3 text-center">
                  <p className="text-brand-gold font-semibold text-sm">Đang xem phòng #{room.id}</p>
                  <p className="text-brand-deep/35 text-xs mt-0.5 font-light">
                    Trả lời quiz để nhận loa và hoa! Bấm vào card để gửi hoa 🌸
                  </p>
                </div>
              )}
              <MiniQuiz />
              <div className="glass overflow-hidden max-h-[200px] sm:max-h-[300px]">
                <div className="px-3 pt-2 pb-1 border-b border-brand-hot/[0.08]">
                  <p className="text-brand-hot text-xs font-semibold uppercase tracking-widest">Chat</p>
                </div>
                <ChatPanel socket={socketRef.current} roomId={currentRoomId} compact myUserId={user?.id} />
              </div>
            </div>
          )}

          {/* Spinning status */}
          {(currentStatus === "SPINNING" || currentStatus === "REVEAL") && (
            <div className="glass px-4 py-3 text-center">
              <motion.p
                className="text-brand-gold font-bold"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                Đang quay thưởng...
              </motion.p>
            </div>
          )}

          {/* Locked status */}
          {currentStatus === "LOCKED" && (
            <div className="glass px-4 py-3 text-center">
              <p className="text-brand-deep font-semibold text-sm">Phòng đã khoá — Sắp bắt đầu đếm ngược...</p>
            </div>
          )}

          {/* Viewer: room done → waiting for next */}
          {isViewer && currentStatus === "DONE" && (
            <div className="glass px-4 py-3 text-center space-y-2">
              <p className="text-brand-deep font-semibold text-sm">Phòng đã quay xong!</p>
              <p className="text-brand-deep/35 text-xs font-light">Sẽ tự động chuyển sang phòng tiếp theo...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    CREATED:   { label: "Chuẩn bị",     color: "bg-brand-deep/10 text-brand-deep/50" },
    WAITING:   { label: "Đang chờ",     color: "bg-status-waiting/20 text-status-waiting" },
    LOCKED:    { label: "Đã khoá",      color: "bg-status-locked/20 text-status-locked" },
    COUNTDOWN: { label: "Đếm ngược",    color: "bg-brand-gold/20 text-brand-gold" },
    SPINNING:  { label: "Đang quay",    color: "bg-status-spinning/20 text-status-spinning animate-pulse" },
    REVEAL:    { label: "Mở thưởng",    color: "bg-brand-rose/20 text-brand-rose" },
    DONE:      { label: "Hoàn thành",   color: "bg-status-done/20 text-status-done" },
  };
  const c = config[status] || config.WAITING;
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${c.color}`}>
      {c.label}
    </span>
  );
}
