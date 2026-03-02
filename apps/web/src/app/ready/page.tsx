"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUser, updateUser, getToken } from "@/lib/auth";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch, apiUpload, getApiUrl } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import EventCountdown from "@/components/EventCountdown";
import LiveStats from "@/components/LiveStats";
import WinnerFeed from "@/components/WinnerFeed";
import WishModal from "@/components/WishModal";
import WishNotification from "@/components/WishNotification";
import type { Socket } from "socket.io-client";

interface ActiveRoom { id: string; status: string; participantCount: number; qrUrl: string; }

// ── Confetti — rose petals pastel ────────────────────────────────────────────
function ConfettiEffect() {
  const particles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: 3 + Math.random() * 94,
      delay: Math.random() * 0.8,
      duration: 1.5 + Math.random() * 1.8,
      color: ["#F4C2D0", "#E8607A", "#FFF0F5", "#D4A88C", "#D4708F", "#FCD5E0", "#FFB3C6", "#C06A82"][i % 8],
      size: 5 + Math.random() * 8,
      xDrift: (Math.random() - 0.5) * 100,
      rotateEnd: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
    }))
  , []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: "20%", width: p.size, height: p.size * 0.7, backgroundColor: p.color }}
          initial={{ y: 0, opacity: 1, rotate: 0, x: 0 }}
          animate={{ y: [0, -130, 380], opacity: [1, 1, 0], rotate: p.rotateEnd, x: [0, p.xDrift] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

// ── Gold corner ornament SVG ──────────────────────────────────────────
function GoldCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const style: Record<string, React.CSSProperties> = {
    tl: { top: 6, left: 6, transform: 'scaleY(-1)' },
    tr: { top: 6, right: 6, transform: 'scale(-1,-1)' },
    bl: { bottom: 6, left: 6 },
    br: { bottom: 6, right: 6, transform: 'scaleX(-1)' },
  };
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ width: 55, height: 55, zIndex: 3, ...style[position] }}
      viewBox="0 0 100 100"
      fill="none"
    >
      <path d="M0 100 C0 58 16 28 48 5" stroke="#C4A478" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M0 100 C42 100 72 84 95 52" stroke="#C4A478" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 75 C14 55 24 40 42 26" stroke="#C4A478" strokeWidth="1" opacity="0.45" strokeLinecap="round"/>
      <path d="M25 88 C42 86 60 76 72 60" stroke="#C4A478" strokeWidth="1" opacity="0.45" strokeLinecap="round"/>
      <path d="M8 68 C14 60 12 50 8 55" stroke="#C4A478" strokeWidth="0.8" fill="#C4A478" fillOpacity={0.12}/>
      <path d="M20 48 C25 40 24 33 20 37" stroke="#C4A478" strokeWidth="0.8" fill="#C4A478" fillOpacity={0.12}/>
      <path d="M48 92 C54 84 52 76 48 80" stroke="#C4A478" strokeWidth="0.8" fill="#C4A478" fillOpacity={0.12}/>
      <path d="M68 80 C73 73 72 66 68 69" stroke="#C4A478" strokeWidth="0.8" fill="#C4A478" fillOpacity={0.12}/>
      <circle cx="48" cy="5" r="3.5" fill="#C4A478" opacity={0.5}/>
      <circle cx="95" cy="52" r="3.5" fill="#C4A478" opacity={0.5}/>
      <circle cx="32" cy="32" r="1.8" fill="#C4A478" opacity={0.3}/>
      <circle cx="62" cy="68" r="1.8" fill="#C4A478" opacity={0.3}/>
      <circle cx="15" cy="52" r="1.2" fill="#C4A478" opacity={0.25}/>
      <circle cx="55" cy="82" r="1.2" fill="#C4A478" opacity={0.25}/>
    </svg>
  );
}

// ── Envelope — Cream/Gold Luxury ──────────────────────────────────────
const PETALS = [
  { emoji: "🌸", x: 8,  y: 20, dur: 3.5 },
  { emoji: "🌷", x: 83, y: 25, dur: 4.2 },
  { emoji: "✿",  x: 12, y: 62, dur: 3.3 },
  { emoji: "🌹", x: 80, y: 58, dur: 4.5 },
  { emoji: "🌸", x: 48, y: 8,  dur: 3.8 },
  { emoji: "💮", x: 30, y: 72, dur: 3.6 },
];

function EnvelopeSealed({ userName, onClick }: { userName: string; onClick: () => void }) {
  return (
    <motion.div
      key="envelope"
      initial={{ opacity: 0, scale: 0.88, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.82, y: -36 }}
      transition={{ duration: 0.5, ease: [0.2, 0, 0.2, 1] }}
      className="envelope-card"
      onClick={onClick}
      whileTap={{ scale: 0.975 }}
    >
      <GoldCorner position="tl" />
      <GoldCorner position="tr" />
      <GoldCorner position="bl" />
      <GoldCorner position="br" />

      <div style={{
        position: "absolute", top: "32%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "70%", height: "55%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(232,96,122,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {PETALS.map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-base pointer-events-none select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ y: [-5, 6, -5], opacity: [0.15, 0.45, 0.15], rotate: [-10, 10, -10] }}
          transition={{ repeat: Infinity, duration: p.dur, delay: i * 0.35, ease: "easeInOut" }}
        >
          {p.emoji}
        </motion.span>
      ))}

      <div
        style={{
          width: 0, height: 0,
          borderLeft: "999px solid transparent",
          borderRight: "999px solid transparent",
          borderTop: "78px solid rgba(196,164,120,0.12)",
          maxWidth: "100%",
          position: "relative", zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          width: 0, height: 0,
          borderLeft: "999px solid transparent",
          borderRight: "999px solid transparent",
          borderTop: "78px solid transparent",
          borderTopColor: "rgba(196,164,120,0.22)",
          maxWidth: "100%",
        }}
      />

      <div className="relative z-10 px-6 pb-8 pt-3 text-center">
        <motion.div
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="mb-3"
          style={{ fontSize: 20, letterSpacing: "0.22em" }}
        >
          🌸 🌹 🌸
        </motion.div>

        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 1.5, -1.5, 0] }}
          transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
          style={{
            width: 90, height: 90,
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 35%, #D4A88C 0%, #C06A82 55%, #8B3A50 100%)",
            boxShadow: "0 0 25px rgba(212,168,140,0.35), 0 4px 16px rgba(139,58,80,0.25), inset 0 0 14px rgba(255,255,255,0.15)",
            border: "2px solid rgba(212,168,140,0.40)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <div style={{ textAlign: "center", lineHeight: 1.2 }}>
            <div style={{ color: "#FFF0F5", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em" }}>8.3</div>
            <div style={{ fontSize: 20, lineHeight: 1 }}>🌸</div>
          </div>
        </motion.div>

        <p style={{ color: "rgba(139,58,80,0.45)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.30em", marginBottom: 6 }}>
          Thiệp dành riêng cho
        </p>
        <h2 style={{ color: "#8B3A50", fontSize: 22, fontWeight: 700, fontStyle: "italic", marginBottom: 20, lineHeight: 1.3, textShadow: "0 2px 18px rgba(232,96,122,0.15)" }}>
          {userName}
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(212,168,140,0.25)" }} />
          <span style={{ color: "rgba(212,168,140,0.60)", fontSize: 10, letterSpacing: "0.22em" }}>✧ ✦ ✧</span>
          <div style={{ flex: 1, height: 1, background: "rgba(212,168,140,0.25)" }} />
        </div>

        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          style={{ display: "inline-block" }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, rgba(196,164,120,0.12) 0%, rgba(212,168,140,0.22) 50%, rgba(196,164,120,0.12) 100%)",
            border: "1px solid rgba(196,164,120,0.50)",
            color: "#C4A478",
            padding: "12px 28px", borderRadius: 9999,
            fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
            boxShadow: "0 0 22px rgba(196,164,120,0.12), inset 0 1px 0 rgba(255,253,245,0.30)",
          }}>
            ✦ Chạm để mở thiệp ✦
          </div>
        </motion.div>

        <div style={{ textAlign: "center", marginTop: 12, color: "#C4A478", fontSize: 16, opacity: 0.5, letterSpacing: "0.3em" }}>
          ❦
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReadyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const [reuploadError, setReuploadError] = useState("");
  const [cardOpened, setCardOpened] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);

  // ── New feature states ──
  const [eventStartTime, setEventStartTime] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState("PENDING");
  const [eventStarted, setEventStarted] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [socketRef, setSocketRef] = useState<Socket | null>(null);
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [pendingWish, setPendingWish] = useState<any>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiFetch<{ rooms: ActiveRoom[] }>("/api/v1/rooms/active", { auth: false });
      setRooms(res.rooms.filter((r) => !["DONE", "SPINNING", "REVEAL"].includes(r.status)));
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch<any>("/api/v1/stats/live", { auth: false });
      setLiveStats(data);
    } catch {}
  }, []);

  const fetchWinners = useCallback(async () => {
    try {
      const data = await apiFetch<{ winners: any[] }>("/api/v1/stats/recent-winners?limit=20", { auth: false });
      setWinners(data.winners);
    } catch {}
  }, []);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    if (!u.selfieUrl) { router.push("/selfie"); return; }
    setUser(u);
    if (u.cardImageUrl) setCardUrl(u.cardImageUrl);

    if (u.greeting) {
      setGreeting(u.greeting);
    } else {
      apiFetch<{ greeting?: string }>("/api/v1/me")
        .then((data) => {
          if (data.greeting) {
            setGreeting(data.greeting);
            updateUser({ greeting: data.greeting });
          }
        })
        .catch(() => {});
    }

    // Fetch event time
    apiFetch<{ eventStartTime: string | null; eventStatus: string }>("/api/v1/stats/event-time", { auth: false })
      .then((data) => {
        setEventStartTime(data.eventStartTime);
        setEventStatus(data.eventStatus);
        if (data.eventStatus === "RUNNING") setEventStarted(true);
      })
      .catch(() => {});

    // Fetch stats & winners
    fetchStats();
    fetchWinners();
    fetchRooms();

    const interval = setInterval(fetchRooms, 5000);

    // WebSocket connection for real-time updates
    const token = getToken();
    const socket = getSocket(token || undefined);
    socket.emit("watch_all");
    setSocketRef(socket);

    socket.on("room_results_ready", () => {
      fetchStats();
      fetchWinners();
    });

    socket.on("wish_received", (data: any) => {
      setPendingWish(data);
    });

    return () => {
      clearInterval(interval);
      socket.off("room_results_ready");
      socket.off("wish_received");
    };
  }, [router, fetchRooms, fetchStats, fetchWinners]);

  function showToast(msg: string, ms = 5000) {
    setToast(msg);
    setTimeout(() => setToast(""), ms);
  }

  function handleOpenCard() {
    setCardOpened(true);
    setTimeout(() => setShowConfetti(true), 300);
    setTimeout(() => setShowConfetti(false), 3500);
  }

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setReuploadError("Vui lòng chọn file ảnh"); return; }
    setReuploadLoading(true);
    setReuploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("template_id", String(user?.cardTemplateId || 1));
      const res = await apiUpload<{ success: boolean; selfieUrl: string; cardImageUrl: string | null; greeting: string | null }>(
        "/api/v1/selfie/upload",
        formData
      );
      if (res.cardImageUrl) {
        updateUser({ selfieUrl: res.selfieUrl, cardImageUrl: res.cardImageUrl, greeting: res.greeting ?? null });
        setUser(getUser());
        setCardUrl(res.cardImageUrl + "?t=" + Date.now());
        if (res.greeting) setGreeting(res.greeting);
        setCardOpened(false);
      }
      showToast("Đã cập nhật ảnh — mở thiệp mới nhe!");
    } catch (err: any) {
      setReuploadError(err.message || "Upload thất bại, thử lại");
    } finally {
      setReuploadLoading(false);
    }
  }

  async function downloadCard() {
    const url = cardUrl || user?.cardImageUrl;
    if (!url) return;
    setSharing(true);
    try {
      const rawUrl = getApiUrl(url.split("?")[0]);
      const res = await fetch(rawUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `thiep-8-3-${(user?.name || "").replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      showToast("Không tải được ảnh, thử lại");
    } finally {
      setSharing(false);
    }
  }

  function shareCard() {
    window.open("https://www.facebook.com", "_blank", "noopener,noreferrer");
  }

  if (!mounted || !user) return null;

  const currentRoom = rooms[0] ?? null;
  const imgSrc = cardUrl
    ? getApiUrl(cardUrl.split("?")[0]) + (cardUrl.includes("?t=") ? "?t=" + cardUrl.split("?t=")[1] : "")
    : user.cardImageUrl ? getApiUrl(user.cardImageUrl) : null;

  const showCountdown = eventStartTime && eventStatus === "PENDING" && !eventStarted;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8 bg-brand-pink relative overflow-hidden">
      {showConfetti && <ConfettiEffect />}

      {/* Wish notification toast */}
      <AnimatePresence>
        {pendingWish && (
          <WishNotification
            wish={pendingWish}
            onDismiss={() => setPendingWish(null)}
          />
        )}
      </AnimatePresence>

      {/* Wish modal */}
      <WishModal isOpen={wishModalOpen} onClose={() => setWishModalOpen(false)} />

      {/* Ambient light atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/20 blur-[100px]" />
        <div className="absolute top-0 right-0 w-[350px] h-[320px] rounded-full bg-brand-blush/50 blur-[80px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[350px] rounded-full bg-white/15 blur-[80px]" />
      </div>

      <div className="w-full max-w-sm space-y-4 relative z-10">

        {/* Header */}
        <div className="text-center animate-fade-in">
          <div className="text-5xl mb-3">🌸</div>
          <h1 className="text-xl font-bold text-brand-deep tracking-wide">Thiệp Đã Sẵn Sàng!</h1>
          <p className="text-brand-hot mt-1 italic font-light">Xin chào, {user.name}</p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="bg-white/70 border border-white/80 rounded-2xl px-4 py-3 text-brand-deep/80 text-sm text-center cursor-pointer font-light shadow-sm"
            onClick={() => setToast("")}
          >
            {toast}
          </div>
        )}

        {/* Event Countdown */}
        {showCountdown && (
          <EventCountdown
            targetTime={eventStartTime!}
            onEventStarted={() => setEventStarted(true)}
          />
        )}

        {/* Live Stats Dashboard */}
        {liveStats && (
          <LiveStats
            totalParticipants={liveStats.totalParticipants}
            spunCount={liveStats.spunCount}
            prizePool={liveStats.prizePool}
          />
        )}

        {/* Winner Feed */}
        <WinnerFeed socket={socketRef} initialWinners={winners} />

        {/* Envelope / Card section */}
        <AnimatePresence mode="wait">
          {imgSrc && !cardOpened ? (
            <EnvelopeSealed key="envelope" userName={user.name} onClick={handleOpenCard} />
          ) : imgSrc && cardOpened ? (
            <motion.div
              key="card-revealed"
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-3"
            >
              <div className="gold-frame p-3 relative">
                <GoldCorner position="tl" />
                <GoldCorner position="tr" />
                <GoldCorner position="bl" />
                <GoldCorner position="br" />

                <div className="relative rounded-2xl overflow-hidden" style={{ zIndex: 1 }}>
                  <img key={cardUrl} src={imgSrc} alt="Thiệp của bạn" className="w-full rounded-2xl" />
                  {reuploadLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                      <p className="text-brand-deep text-sm font-light animate-pulse">Đang tạo thiệp mới...</p>
                    </div>
                  )}
                </div>

                {greeting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="mt-4 px-1 text-center relative" style={{ zIndex: 1 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-px" style={{ background: "rgba(196,164,120,0.30)" }} />
                      <span style={{ color: "rgba(196,164,120,0.70)", fontSize: 10 }} className="uppercase tracking-widest font-light">✧ Lời chúc riêng cho bạn ✧</span>
                      <div className="flex-1 h-px" style={{ background: "rgba(196,164,120,0.30)" }} />
                    </div>
                    <p className="text-sm italic leading-relaxed px-2 font-light" style={{ color: "#8B3A50", opacity: 0.85 }}>&ldquo;{greeting}&rdquo;</p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.0, duration: 0.4 }}
                      className="text-xs font-medium mt-3"
                      style={{ color: "#C4A478" }}
                    >
                      Chúc Mừng Ngày 8/3
                    </motion.p>
                  </motion.div>
                )}

                <div className="h-px mt-4 mb-3" style={{ background: "rgba(196,164,120,0.20)" }} />

                <div className="flex gap-2">
                  <button
                    onClick={downloadCard}
                    disabled={sharing || reuploadLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-hot/15 text-brand-hot font-semibold py-2.5 rounded-2xl hover:bg-brand-hot/25 hover:shadow-[0_0_20px_rgba(232,96,122,0.15)] active:scale-[0.98] transition-all duration-300 text-sm disabled:opacity-50"
                  >
                    {sharing ? "..." : "Tải thiệp về"}
                  </button>
                  <button
                    onClick={shareCard}
                    disabled={sharing || reuploadLoading}
                    className="flex items-center justify-center gap-1.5 bg-[#1877F2]/15 text-[#1877F2] font-semibold px-4 py-2.5 rounded-2xl hover:bg-[#1877F2]/25 active:scale-[0.98] transition-all duration-300 text-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Send Wish + Gallery buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setWishModalOpen(true)}
            className="flex-1 glass px-4 py-3 rounded-2xl text-sm font-semibold text-brand-hot hover:bg-brand-hot/[0.08] active:scale-[0.98] transition-all duration-300 text-center"
          >
            🌸 Gửi lời chúc
          </button>
          <button
            onClick={() => router.push("/gallery")}
            className="flex-1 glass px-4 py-3 rounded-2xl text-sm font-semibold text-brand-deep/60 hover:bg-brand-deep/[0.04] active:scale-[0.98] transition-all duration-300 text-center"
          >
            🖼️ Xem Gallery
          </button>
        </div>

        {/* Đổi ảnh checkin */}
        <div className="glass p-4">
          <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest mb-3">Ảnh Checkin</p>
          <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border cursor-pointer
            ${reuploadLoading
              ? "opacity-50 pointer-events-none border-brand-hot/10 text-brand-deep/25 bg-white/30"
              : "border-brand-hot/30 text-brand-hot bg-brand-hot/[0.08] hover:bg-brand-hot/[0.15] hover:shadow-[0_0_20px_rgba(232,96,122,0.1)]"
            }`}
          >
            {reuploadLoading ? "Đang xử lý..." : "Đổi ảnh checkin"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReupload}
              disabled={reuploadLoading}
            />
          </label>
          {reuploadError && (
            <p className="text-red-500 text-xs text-center mt-2">{reuploadError}</p>
          )}
          <p className="text-brand-deep/30 text-xs text-center mt-2 font-light">Chọn ảnh mới — thiệp sẽ được tạo lại tự động</p>
        </div>

        {/* Has spun — result link + viewer option */}
        {user.hasSpun && (
          <div className="glass p-4 space-y-3">
            <button
              onClick={() => router.push("/result")}
              className="w-full glass px-4 py-3 rounded-2xl text-sm font-semibold text-brand-gold hover:bg-brand-gold/[0.08] active:scale-[0.98] transition-all duration-300 text-center"
            >
              🏆 Xem kết quả quay thưởng
            </button>
          </div>
        )}

        {/* QR + Join section */}
        {currentRoom ? (
          <div className="glass p-4">
            <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest text-center mb-3">
              {user.hasSpun ? "Xem phòng đang diễn ra" : "Scan QR để tham gia phòng"}
            </p>
            <div className="flex justify-center mb-3">
              <div className="bg-white p-2 rounded-2xl shadow-sm">
                <QRCodeSVG value={currentRoom.qrUrl} size={160} fgColor="#8B3A50" />
              </div>
            </div>
            <p className="text-brand-deep/40 text-xs text-center mb-1 font-light">
              Phòng #{currentRoom.id} — {currentRoom.participantCount}/12 người
            </p>
            {user.hasSpun ? (
              <button
                onClick={() => router.push(`/join?room=${currentRoom.id}`)}
                className="w-full bg-gradient-to-r from-brand-gold/80 to-brand-mauve text-white font-bold py-3.5 rounded-2xl hover:shadow-[0_0_30px_rgba(196,151,122,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-base mt-2"
              >
                XEM PHÒNG (Khán giả)
              </button>
            ) : (
              <button
                onClick={() => router.push(`/join?room=${currentRoom.id}`)}
                className="w-full bg-gradient-to-r from-brand-hot to-brand-mauve text-white font-bold py-3.5 rounded-2xl hover:shadow-[0_0_30px_rgba(232,96,122,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-base mt-2"
              >
                THAM GIA PHÒNG NGAY
              </button>
            )}
          </div>
        ) : (
          <div className="glass p-5 text-center">
            <div className="text-3xl mb-2 animate-breathe">🌸</div>
            <p className="text-brand-deep/60 text-sm font-light">Chưa có phòng nào đang mở.</p>
            <p className="text-brand-deep/35 text-xs mt-1 font-light">Chờ admin tạo phòng và scan QR trên màn hình livestream.</p>
          </div>
        )}

        {/* Instructions */}
        <div className="glass p-4">
          <p className="text-brand-deep font-semibold mb-2 text-sm">Cách tham gia:</p>
          <ol className="space-y-1.5 text-brand-deep/60 text-sm font-light">
            <li className="flex gap-2"><span className="text-brand-hot font-bold">1.</span> Nhìn lên màn hình livestream</li>
            <li className="flex gap-2"><span className="text-brand-hot font-bold">2.</span> Scan QR code hiển thị trên màn hình</li>
            <li className="flex gap-2"><span className="text-brand-hot font-bold">3.</span> Hoặc scan QR bên trên nếu có phòng</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
