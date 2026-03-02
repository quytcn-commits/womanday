"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { getToken, getUser, updateUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import RoomGrid from "@/components/RoomGrid";
import CountdownTimer from "@/components/CountdownTimer";
import SpinAnimation from "@/components/SpinAnimation";
import MiniQuiz from "@/components/MiniQuiz";
import ChatPanel from "@/components/ChatPanel";
import MegaphoneOverlay from "@/components/MegaphoneOverlay";
import type { Room, RoomStatus, PrizeTier } from "@womanday/types";

function JoinRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  const [room, setRoom] = useState<Room | null>(null);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [isSpinning, setIsSpinning] = useState(false);
  const [revealedSlots, setRevealedSlots] = useState(new Set<number>());
  const [results, setResults] = useState<Record<number, { tier: string; value: number; label: string }>>({});
  const [myResult, setMyResult] = useState<{ tier: PrizeTier; value: number; label: string } | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Viewer mode
  const [isViewer, setIsViewer] = useState(false);
  const [flowerBalance, setFlowerBalance] = useState(0);
  const [flowerCounts, setFlowerCounts] = useState<Record<number, number>>({});
  const [viewerCount, setViewerCount] = useState(0);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const user = getUser();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (!roomId) { router.push("/ready"); return; }

    // Auto viewer mode for hasSpun users
    if (user.hasSpun) {
      setIsViewer(true);
    }

    apiFetch<Room>(`/api/v1/rooms/${roomId}`)
      .then((r) => {
        setRoom(r);
        setStatus(r.status as RoomStatus);
        const myParticipant = r.participants.find((p) => p.userId === user.id);
        if (myParticipant) {
          setMySlot(myParticipant.slotIndex);
          setJoined(true);
        }
      })
      .catch((err: any) => {
        if (err.code === 401 || err.data?.error === "UNAUTHORIZED") {
          router.push("/login");
          return;
        }
        setError(err.data?.message || err.message || "Không tìm thấy phòng");
      });

    const token = getToken();
    const socket = getSocket(token || undefined);
    socketRef.current = socket;
    socket.emit("join_room", { roomId });

    // If already hasSpun, auto join as viewer
    if (user.hasSpun) {
      socket.emit("join_room_viewer", { roomId });
    }

    socket.on("participant_joined", (data: any) => {
      if (data.roomId !== roomId) return;
      setRoom((prev) => {
        if (!prev) return prev;
        const updated = [...prev.participants];
        const idx = updated.findIndex((p) => p.slotIndex === data.slotIndex);
        if (idx >= 0) {
          updated[idx] = { ...data.participant, slotIndex: data.slotIndex, state: "JOINED" };
        }
        return { ...prev, participants: updated, participantCount: data.participantCount };
      });
    });

    socket.on("room_locked", (data: any) => {
      if (data.roomId !== roomId) return;
      setStatus("LOCKED");
    });

    socket.on("countdown_started", (data: any) => {
      if (data.roomId !== roomId) return;
      setStatus("COUNTDOWN");
      setCountdown(data.remainingSeconds);
    });

    socket.on("countdown_tick", (data: any) => {
      if (data.roomId !== roomId) return;
      setCountdown(data.remainingSeconds);
    });

    socket.on("spin_started", (data: any) => {
      if (data.roomId !== roomId) return;
      setStatus("SPINNING");
      setIsSpinning(true);
    });

    socket.on("reveal_result", (data: any) => {
      if (data.roomId !== roomId) return;
      setRevealedSlots((prev) => new Set([...prev, data.slotIndex]));
      setResults((prev) => ({ ...prev, [data.slotIndex]: data.prize }));
      if (data.user.userId === user.id) {
        setMyResult(data.prize);
      }
    });

    socket.on("room_results_ready", (data: any) => {
      if (data.roomId !== roomId) return;
      setStatus("DONE");
      setIsSpinning(false);
      // Only redirect participants, not viewers
      if (!user.hasSpun) {
        updateUser({ hasSpun: true });
        setTimeout(() => router.push("/result"), 3000);
      }
    });

    // Flower events
    socket.on("flower_received", (data: any) => {
      if (data.roomId !== roomId) return;
      setFlowerCounts((prev) => ({ ...prev, [data.slotIndex]: data.totalFlowers }));
    });

    socket.on("flower_balance", (data: any) => {
      setFlowerBalance(data.flowerBalance);
    });

    socket.on("flower_state", (data: any) => {
      if (data.roomId !== roomId) return;
      setFlowerCounts(data.flowers || {});
    });

    socket.on("viewer_count", (data: any) => {
      if (data.roomId !== roomId) return;
      setViewerCount(data.count);
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
    };
  }, [roomId, router, user]);

  // Load flower balance on mount
  useEffect(() => {
    apiFetch<{ flowerBalance: number }>("/api/v1/quiz/balance")
      .then((b) => setFlowerBalance(b.flowerBalance))
      .catch(() => {});
  }, []);

  async function handleJoin() {
    if (!roomId || !user) return;
    setJoining(true);
    setError("");
    try {
      const res = await apiFetch<{ success: boolean; slotIndex: number }>(`/api/v1/rooms/${roomId}/join`, {
        method: "POST",
      });
      setMySlot(res.slotIndex);
      setJoined(true);
    } catch (err: any) {
      const errCode = err.data?.error;
      if (errCode === "ALREADY_SPUN") {
        // Instead of redirect, switch to viewer mode
        setIsViewer(true);
        socketRef.current?.emit("join_room_viewer", { roomId });
        return;
      }
      if (err.code === 401) { router.push("/login"); return; }
      setError(err.data?.message || err.message || "Không thể tham gia phòng");
    } finally {
      setJoining(false);
    }
  }

  function handleViewerJoin() {
    if (!roomId) return;
    setIsViewer(true);
    socketRef.current?.emit("join_room_viewer", { roomId });
  }

  function handleSendFlower(slotIndex: number) {
    if (!roomId || flowerBalance < 1) return;
    socketRef.current?.emit("send_flower", { roomId, slotIndex });
    setFlowerBalance((b) => Math.max(0, b - 1));
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-pink">
        <div className="glass p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🌸</div>
          <p className="text-brand-deep/60 font-light">{error}</p>
          <button onClick={() => router.push("/ready")} className="mt-4 text-brand-hot text-sm hover:text-brand-hot/80 transition-colors">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-pink">
        <div className="text-brand-deep/40 animate-pulse font-light">Đang tải phòng...</div>
      </div>
    );
  }

  const currentStatus = status || room.status;
  const canJoinAsParticipant = !joined && !isViewer && !user?.hasSpun && (currentStatus === "WAITING" || currentStatus === "CREATED");
  const showViewerButton = !joined && !isViewer && (currentStatus === "WAITING" || currentStatus === "CREATED");

  return (
    <div className="min-h-screen flex flex-col items-center bg-brand-pink relative overflow-hidden">
      <SpinAnimation isSpinning={isSpinning} />
      <MegaphoneOverlay socket={socketRef.current} />

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/20 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-brand-blush/50 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col min-h-screen px-4 relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <div>
            <h1 className="text-brand-deep font-black text-lg tracking-wider uppercase">
              {room.name ? `${room.name} — ` : ""}Phòng #{room.id}
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
            <p className="text-brand-hot font-black text-xl leading-none">
              {room.participantCount}<span className="text-brand-deep/25 text-sm font-normal">/12</span>
            </p>
            {viewerCount > 0 && (
              <p className="text-brand-deep/35 text-[10px] font-light">👁 {viewerCount} khán giả</p>
            )}
            {flowerBalance > 0 && (
              <p className="text-brand-gold text-xs font-semibold">🌸 x{flowerBalance}</p>
            )}
          </div>
        </div>

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

        {/* Champion Grid */}
        <div className="flex-1 py-2">
          <RoomGrid
            participants={room.participants}
            status={currentStatus as any}
            revealedSlots={revealedSlots}
            results={results}
            mySlot={mySlot}
            flowerCounts={flowerCounts}
            onSendFlower={handleSendFlower}
            canSendFlower={flowerBalance > 0}
          />
        </div>

        {/* Bottom bar */}
        <div className="pb-6 pt-2 space-y-2">
        {/* My result preview (participants only) */}
        <AnimatePresence>
          {myResult && !isViewer && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="glass p-4 text-center border border-brand-gold/30"
            >
              <div className="text-4xl mb-1">
                {myResult.tier === "FIRST" ? "🌟" : myResult.tier === "SECOND" ? "✨" : myResult.tier === "THIRD" ? "🌸" : "💐"}
              </div>
              <p className="text-brand-deep font-bold">{myResult.label}</p>
              <p className="text-brand-deep/40 text-xs mt-1 font-light">Đang tạo ảnh kết quả...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join buttons */}
        {canJoinAsParticipant && (
          <motion.button
            onClick={handleJoin}
            disabled={joining}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-gradient-to-r from-brand-hot via-brand-rose to-brand-mauve text-white font-black py-4 rounded-2xl hover:shadow-[0_0_35px_rgba(232,96,122,0.3)] hover:scale-[1.02] transition-all duration-300 text-base disabled:opacity-50"
          >
            {joining ? "Đang tham gia..." : "THAM GIA PHÒNG"}
          </motion.button>
        )}

        {showViewerButton && (
          <motion.button
            onClick={handleViewerJoin}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-white/60 border border-brand-gold/30 text-brand-gold font-bold py-3 rounded-2xl hover:bg-white/80 hover:border-brand-gold/50 transition-all duration-300 text-sm"
          >
            👁 XEM PHÒNG (Khán giả)
          </motion.button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Joined participant waiting */}
        {joined && !isViewer && (currentStatus === "WAITING" || currentStatus === "CREATED") && (
          <div className="space-y-3">
            <div className="glass px-4 py-3 text-center">
              <p className="text-brand-hot font-semibold text-sm">Bạn đã vào phòng — Slot #{mySlot}</p>
              <p className="text-brand-deep/35 text-xs mt-0.5 font-light">Đang chờ phòng bắt đầu...</p>
            </div>
            <MiniQuiz />
          </div>
        )}

        {/* Viewer content */}
        {isViewer && (currentStatus === "WAITING" || currentStatus === "CREATED") && (
          <div className="space-y-3">
            <div className="glass px-4 py-3 text-center">
              <p className="text-brand-gold font-semibold text-sm">Bạn đang xem phòng này</p>
              <p className="text-brand-deep/35 text-xs mt-0.5 font-light">
                Trả lời quiz để nhận loa và hoa! Bấm vào card để gửi hoa 🌸
              </p>
            </div>
            <MiniQuiz />
            <div className="glass overflow-hidden" style={{ maxHeight: 300 }}>
              <div className="px-3 pt-2 pb-1 border-b border-brand-hot/[0.08]">
                <p className="text-brand-hot text-xs font-semibold uppercase tracking-widest">Chat</p>
              </div>
              <ChatPanel socket={socketRef.current} roomId={roomId} compact myUserId={user?.id} />
            </div>
          </div>
        )}

        {/* Viewer watching spin/reveal */}
        {isViewer && (currentStatus === "SPINNING" || currentStatus === "REVEAL") && (
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

        {/* Viewer: room done */}
        {isViewer && currentStatus === "DONE" && (
          <div className="glass px-4 py-3 text-center space-y-2">
            <p className="text-brand-deep font-semibold text-sm">Phòng đã quay xong!</p>
            <button
              onClick={() => router.push("/ready")}
              className="text-brand-hot text-xs font-semibold hover:text-brand-hot/70 transition-colors"
            >
              Quay lại
            </button>
          </div>
        )}

        {/* Non-viewer status messages */}
        {!isViewer && currentStatus === "LOCKED" && (
          <div className="glass px-4 py-3 text-center">
            <p className="text-brand-deep font-semibold text-sm">Phòng đã khoá — Sắp bắt đầu đếm ngược...</p>
          </div>
        )}

        {!isViewer && (currentStatus === "SPINNING" || currentStatus === "REVEAL") && (
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

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-pink text-brand-deep/40 font-light">Đang tải...</div>}>
      <JoinRoomContent />
    </Suspense>
  );
}
