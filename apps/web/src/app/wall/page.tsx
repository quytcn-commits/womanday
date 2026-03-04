"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";
import RoomGrid from "@/components/RoomGrid";
import CountdownTimer from "@/components/CountdownTimer";
import SpinAnimation from "@/components/SpinAnimation";
import ChatPanel from "@/components/ChatPanel";
import MegaphoneOverlay from "@/components/MegaphoneOverlay";
import FlowerAnimation from "@/components/FlowerAnimation";
import type { RoomStatus, PrizeTier } from "@womanday/types";

interface ActiveRoom {
  id: string;
  name: string | null;
  status: RoomStatus;
  participantCount: number;
  participants: any[];
  qrUrl: string;
  autoStartAt: string | null;
}

interface RoomOption { id: string; status: string; participantCount: number; qrUrl: string; }

interface RevealEntry {
  slotIndex: number;
  tier: PrizeTier;
  value: number;
  label: string;
  name: string;
  dept: string;
  isHighTier: boolean;
}

// ── Floating petals — ethereal background for big screen ─────────────────────
const WALL_PETALS_DATA = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  emoji: ["🌸", "✿", "💮", "🌷", "❀"][i % 5],
  x: 3 + (i * 4.7) % 92,
  dur: 18 + (i % 6) * 3,
  delay: -(i * 2.1) % 18,
  size: 16 + (i % 4) * 5,
  drift: (i % 2 === 0 ? 1 : -1) * (15 + (i % 4) * 10),
}));

function FloatingPetals() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {WALL_PETALS_DATA.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none"
          style={{ left: `${p.x}%`, top: "-6%", fontSize: p.size, opacity: 0.35 }}
          animate={{
            y: ["0vh", "108vh"],
            x: [0, p.drift],
            rotate: [0, p.id % 2 === 0 ? 240 : -240],
            opacity: [0, 0.40, 0.35, 0.20, 0],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}

export default function WallPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-brand-pink">
        <div className="text-brand-deep/40 text-xl font-light">Đang tải...</div>
      </div>
    }>
      <WallPageContent />
    </Suspense>
  );
}

function WallPageContent() {
  const searchParams = useSearchParams();
  const paramRoom = searchParams.get("room");

  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(paramRoom);
  const [showSelector, setShowSelector] = useState(!paramRoom);

  const [currentRoom, setCurrentRoom] = useState<ActiveRoom | null>(null);
  const [status, setStatus] = useState<RoomStatus>("CREATED");
  const [countdown, setCountdown] = useState(30);
  const [isSpinning, setIsSpinning] = useState(false);
  const [revealedSlots, setRevealedSlots] = useState(new Set<number>());
  const [results, setResults] = useState<Record<number, { tier: string; value: number; label: string }>>({});
  const [reveals, setReveals] = useState<RevealEntry[]>([]);
  const [totalSpun, setTotalSpun] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [socketInstance, setSocketInstance] = useState<ReturnType<typeof getSocket> | null>(null);
  const [flowerCounts, setFlowerCounts] = useState<Record<number, number>>({});

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiFetch<{ rooms: RoomOption[] }>("/api/v1/rooms/active", { auth: false });
      setRoomOptions(res.rooms);
      if (!selectedRoomId && res.rooms.length === 1) {
        setSelectedRoomId(res.rooms[0].id);
        setShowSelector(false);
      }
    } catch {}
  }, [selectedRoomId]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  useEffect(() => {
    const socket = getSocket();
    setSocketInstance(socket);
    socket.emit("watch_all");

    socket.on("room_created", (data: any) => {
      setRoomOptions((prev) => {
        const exists = prev.find((r) => r.id === data.roomId);
        if (exists) return prev;
        return [...prev, { id: data.roomId, status: "CREATED", participantCount: 0, qrUrl: data.qrUrl }];
      });
      if (!selectedRoomId) {
        setSelectedRoomId(data.roomId);
        setShowSelector(false);
        setCurrentRoom({
          id: data.roomId,
          name: data.name || null,
          status: "CREATED",
          participantCount: 0,
          participants: Array.from({ length: 12 }, (_, i) => ({
            slotIndex: i + 1, userId: null, name: null, dept: null, selfieUrl: null, cardImageUrl: null, state: "EMPTY"
          })),
          qrUrl: data.qrUrl,
          autoStartAt: null,
        });
        setStatus("CREATED");
        setRevealedSlots(new Set());
        setResults({});
        setReveals([]);
      }
    });

    socket.on("participant_joined", (data: any) => {
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== data.roomId) return prev;
        const updated = [...prev.participants];
        const idx = updated.findIndex((p) => p.slotIndex === data.slotIndex);
        if (idx >= 0) updated[idx] = { ...data.participant, slotIndex: data.slotIndex, state: "JOINED" };
        return { ...prev, participants: updated, participantCount: data.participantCount };
      });
      setStatus("WAITING");
    });

    socket.on("room_locked", (data: any) => {
      setCurrentRoom((prev) => prev && prev.id === data.roomId ? ({ ...prev, status: "LOCKED" as RoomStatus }) : prev);
      setStatus("LOCKED");
    });

    socket.on("countdown_started", (data: any) => {
      setStatus("COUNTDOWN");
      setCountdown(data.remainingSeconds);
    });

    socket.on("countdown_tick", (data: any) => {
      setCountdown(data.remainingSeconds);
    });

    socket.on("spin_started", (_data: any) => {
      setStatus("SPINNING");
      setIsSpinning(true);
      setRevealedSlots(new Set());
    });

    socket.on("reveal_result", (data: any) => {
      setRevealedSlots((prev) => new Set([...prev, data.slotIndex]));
      setResults((prev) => ({ ...prev, [data.slotIndex]: data.prize }));
      setReveals((prev) => [
        ...prev,
        {
          slotIndex: data.slotIndex,
          tier: data.prize.tier,
          value: data.prize.value,
          label: data.prize.label,
          name: data.user.name,
          dept: data.user.dept,
          isHighTier: data.isHighTier,
        },
      ]);
    });

    socket.on("room_results_ready", (data: any) => {
      setStatus("DONE");
      setIsSpinning(false);
      setTotalSpun((prev) => prev + data.results.length);
    });

    socket.on("room_status_sync", (data: any) => {
      setStatus(data.status as RoomStatus);
    });

    socket.on("flower_received", (data: any) => {
      setFlowerCounts((prev) => ({
        ...prev,
        [data.slotIndex]: data.totalFlowers,
      }));
    });

    socket.on("flower_state", (data: any) => {
      if (data.flowers) setFlowerCounts(data.flowers);
    });

    // Auto-switch to next active room when current room is DONE
    socket.on("active_room_changed", (data: any) => {
      if (data.roomId && data.roomId !== selectedRoomId) {
        setSelectedRoomId(data.roomId);
        setShowSelector(false);
      }
    });

    return () => {
      socket.off("room_created");
      socket.off("participant_joined");
      socket.off("room_locked");
      socket.off("countdown_started");
      socket.off("countdown_tick");
      socket.off("spin_started");
      socket.off("reveal_result");
      socket.off("room_results_ready");
      socket.off("room_status_sync");
      socket.off("flower_received");
      socket.off("flower_state");
      socket.off("active_room_changed");
    };
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    const BASE = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    setCurrentRoom({
      id: selectedRoomId,
      name: null,
      status: "CREATED",
      participantCount: 0,
      participants: Array.from({ length: 12 }, (_, i) => ({
        slotIndex: i + 1, userId: null, name: null, dept: null, selfieUrl: null, cardImageUrl: null, state: "EMPTY",
      })),
      qrUrl: `${BASE}/join?room=${selectedRoomId}`,
      autoStartAt: null,
    });
    setStatus("CREATED");
    setRevealedSlots(new Set());
    setResults({});
    setReveals([]);
    setFlowerCounts({});
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || roomOptions.length === 0) return;
    const opt = roomOptions.find((r) => r.id === selectedRoomId);
    if (!opt) return;
    setCurrentRoom((prev) => {
      if (!prev || prev.id !== selectedRoomId) return prev;
      return { ...prev, status: opt.status as RoomStatus, participantCount: opt.participantCount, qrUrl: opt.qrUrl };
    });
    setStatus(opt.status as RoomStatus);
  }, [selectedRoomId, roomOptions]);

  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-gradient-to-br from-brand-pink via-brand-blush to-brand-cream relative select-none">
      <SpinAnimation isSpinning={isSpinning} />
      <FlowerAnimation socket={socketInstance} columns={6} />
      <MegaphoneOverlay socket={socketInstance} />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-white/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[500px] rounded-full bg-brand-blush/40 blur-[90px]" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[350px] rounded-full bg-white/20 blur-[90px]" />
      </div>

      <FloatingPetals />

      {/* Room Selector Overlay */}
      <AnimatePresence>
        {showSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-brand-deep/60 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass p-8 max-w-md w-full mx-4"
            >
              <h2 className="text-brand-deep text-xl font-bold mb-2 text-center tracking-wide">Chọn phòng để live</h2>
              <p className="text-brand-deep/40 text-sm text-center mb-6 font-light">Chọn phòng muốn hiển thị trên màn hình lớn</p>
              {roomOptions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3 animate-breathe">🌸</div>
                  <p className="text-brand-deep/40 font-light">Chưa có phòng nào. Admin cần tạo phòng trước.</p>
                  <button
                    onClick={fetchRooms}
                    className="mt-4 text-brand-hot text-sm hover:text-brand-hot/80 transition-colors"
                  >
                    Tải lại
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {roomOptions.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedRoomId(r.id); setShowSelector(false); }}
                      className="w-full glass p-4 flex items-center justify-between hover:bg-white/80 transition-all duration-300 rounded-2xl border border-white/60"
                    >
                      <div className="text-left">
                        <p className="text-brand-deep font-bold">Phòng #{r.id}</p>
                        <p className="text-brand-deep/40 text-xs mt-0.5 font-light">{r.participantCount}/12 người</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        r.status === "WAITING" ? "bg-status-waiting/20 text-status-waiting" :
                        r.status === "CREATED" ? "bg-brand-deep/10 text-brand-deep/50" :
                        r.status === "COUNTDOWN" ? "bg-brand-gold/20 text-brand-gold" :
                        "bg-status-done/20 text-status-done"
                      }`}>{r.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Panel: QR + Chat */}
      <div className="w-[320px] flex-shrink-0 flex flex-col gap-3 p-4 border-r border-brand-hot/[0.12] relative z-10">
        {/* QR */}
        <div className="glass p-4 flex flex-col items-center gap-2">
          {currentRoom ? (
            <>
              <p className="text-brand-deep/45 text-xs font-light uppercase tracking-widest">Scan để tham gia</p>
              <div className="bg-white p-2 rounded-2xl shadow-sm">
                <QRCodeSVG
                  value={currentRoom.qrUrl || `${BASE_URL}/join?room=${currentRoom.id}`}
                  size={180}
                  fgColor="#8B3A50"
                />
              </div>
              <p className="text-brand-hot font-bold text-sm">
                {(currentRoom as any).name ? `${(currentRoom as any).name} — ` : ""}Phòng #{currentRoom.id}
              </p>
              <p className="text-brand-deep/40 text-xs font-light">{currentRoom.participantCount}/12 người đã vào</p>
              {["CREATED", "WAITING"].includes(status) && (
                <p className="text-brand-deep/20 text-xs text-center font-light">
                  {`${BASE_URL}/join?room=${currentRoom.id}`}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-3xl mb-2 animate-breathe">🌸</div>
              <p className="text-brand-deep/50 text-sm font-light">Chưa chọn phòng</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="glass px-4 py-2 flex items-center justify-between">
          <span className="text-brand-deep/35 text-xs font-light">Đã quay hôm nay</span>
          <span className="text-brand-gold font-bold">{totalSpun}<span className="text-brand-deep/25">/400</span></span>
        </div>

        {/* Chat */}
        <div className="glass flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-2 pb-1 border-b border-brand-hot/[0.08]">
            <p className="text-brand-hot text-xs font-semibold uppercase tracking-widest">Live Chat</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel socket={socketInstance} compact={true} />
          </div>
        </div>
      </div>

      {/* Center: Room grid + status */}
      <div className="flex-1 flex flex-col p-4 relative z-10 overflow-hidden">
        {/* Title — festive header */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div>
            <motion.p
              className="text-[10px] tracking-[0.40em] uppercase mb-0.5 font-light"
              style={{ color: "rgba(232,96,122,0.55)" }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              ✧ Chúc Mừng Ngày Phụ Nữ Quốc Tế ✧
            </motion.p>
            <motion.h1
              className="text-xl font-black tracking-wider uppercase"
              style={{
                background: "linear-gradient(90deg, #E8607A 0%, #8B3A50 45%, #D4A88C 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              Women&apos;s Day — 8/3/2026
            </motion.h1>
          </div>
          {currentRoom && (
            <WallStatusBanner status={status} roomId={currentRoom.id} roomName={currentRoom.name} />
          )}
        </div>

        {currentRoom ? (
          <>
            <div className="flex-1 min-h-0 relative">
              {/* Countdown — overlays on top of grid */}
              <AnimatePresence>
                {status === "COUNTDOWN" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-white/20 backdrop-blur-[2px] rounded-2xl"
                  >
                    <CountdownTimer seconds={countdown} label="Quay sau" />
                  </motion.div>
                )}
              </AnimatePresence>
              <RoomGrid
                participants={currentRoom.participants}
                status={status}
                revealedSlots={revealedSlots}
                results={results}
                flowerCounts={flowerCounts}
              />
            </div>

            {/* Reveal feed — bottom strip */}
            <AnimatePresence>
              {status === "DONE" && reveals.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-shrink-0 mt-3"
                >
                  <div className="glass p-3">
                    <p className="text-brand-deep/50 text-xs font-light text-center mb-2 tracking-wider">Kết quả phòng #{currentRoom.id}</p>
                    <div className="flex gap-2 flex-wrap justify-center">
                      {reveals.map((r) => (
                        <div
                          key={r.slotIndex}
                          className={`glass px-3 py-1.5 text-center min-w-[100px] ${r.isHighTier ? "border border-brand-gold/30" : ""}`}
                        >
                          <p className="text-brand-deep text-xs font-semibold truncate max-w-[90px]">{r.name.split(" ").slice(-2).join(" ")}</p>
                          <p className={`text-xs font-bold ${r.isHighTier ? "prize-first" : "prize-cons"}`}>
                            {r.label || r.tier}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-8xl mb-6 animate-breathe">🌸</div>
            <p className="text-brand-deep/40 text-xl font-light">Đang chờ admin tạo phòng...</p>
            <p className="text-brand-deep/25 text-sm mt-2 font-light tracking-wider">Sự kiện Ngày Phụ Nữ Quốc Tế 8/3/2026</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-20">
        <button
          onClick={() => setShowSelector(true)}
          className="glass px-3 py-2 text-sm text-brand-deep/50 hover:text-brand-deep/80 transition-colors duration-300"
        >
          Đổi phòng
        </button>
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="glass px-3 py-2 text-sm text-brand-deep/50 hover:text-brand-deep/80 transition-colors duration-300"
        >
          {soundOn ? "Sound" : "Muted"}
        </button>
      </div>
    </div>
  );
}

function WallStatusBanner({ status, roomId, roomName }: { status: RoomStatus; roomId: string; roomName?: string | null }) {
  const prefix = roomName ? `${roomName} (#${roomId})` : `Phòng #${roomId}`;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    CREATED:   { bg: "bg-brand-deep/10", text: "text-brand-deep/50", label: `${prefix} — Chuẩn bị` },
    WAITING:   { bg: "bg-status-waiting/20", text: "text-status-waiting", label: `${prefix} — Đang chờ người tham gia` },
    LOCKED:    { bg: "bg-status-locked/20", text: "text-status-locked", label: `${prefix} — Đã khóa` },
    COUNTDOWN: { bg: "bg-brand-gold/20", text: "text-brand-gold", label: `${prefix} — Sắp quay!` },
    SPINNING:  { bg: "bg-status-spinning/20", text: "text-status-spinning", label: `${prefix} — ĐANG QUAY...` },
    REVEAL:    { bg: "bg-brand-rose/20", text: "text-brand-rose", label: `${prefix} — Mở thưởng!` },
    DONE:      { bg: "bg-status-done/20", text: "text-status-done", label: `${prefix} — Đã xong` },
  };
  const c = config[status] || config.WAITING;
  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-6 py-2 rounded-full ${c.bg} ${c.text} font-semibold text-sm`}
    >
      {c.label}
    </motion.div>
  );
}
