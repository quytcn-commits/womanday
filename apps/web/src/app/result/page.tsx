"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, getApiUrl } from "@/lib/api";
import { getUser, getToken } from "@/lib/auth";
import { getSocket } from "@/lib/socket";

interface ResultData {
  resultImageUrl: string | null;
  shareUrl: string | null;
  caption: string | null;
  spinLog: { tier: string; value: number; spunAt: string } | null;
}

/* ── Floating petal component ─────────────────────────── */
const PETALS = ["🌸", "🌷", "💮", "🏵️", "✿", "❀"];
function FloatingPetals() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 12 }).map((_, i) => {
        const petal = PETALS[i % PETALS.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 8;
        const duration = 10 + Math.random() * 8;
        const size = 14 + Math.random() * 10;
        return (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${left}%`,
              top: `-${size + 10}px`,
              fontSize: `${size}px`,
              opacity: 0.15 + Math.random() * 0.15,
              animation: `petalDrift ${duration}s ${delay}s linear infinite`,
            }}
          >
            {petal}
          </div>
        );
      })}
    </div>
  );
}

/* ── Confetti burst on mount ──────────────────────────── */
function ConfettiBurst() {
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; color: string; size: number; angle: number; speed: number }[]
  >([]);

  useEffect(() => {
    const colors = ["#E8607A", "#F9B4C8", "#C07828", "#B03060", "#FCD5E0", "#D4708F", "#FFFFFF"];
    const items = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 20,
      y: 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      angle: Math.random() * Math.PI * 2,
      speed: 2 + Math.random() * 4,
    }));
    setParticles(items);
    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: `${p.y}vh`, scale: 1, opacity: 1 }}
          animate={{
            x: `${p.x + Math.cos(p.angle) * p.speed * 15}vw`,
            y: `${p.y + Math.sin(p.angle) * p.speed * 12 + 40}vh`,
            scale: 0,
            opacity: 0,
            rotate: Math.random() * 720,
          }}
          transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

/* ── Gold corner ornament (SVG) ───────────────────────── */
function GoldCorner({ className }: { className?: string }) {
  return (
    <svg className={className} width="36" height="36" viewBox="0 0 36 36" fill="none">
      <path d="M2 34 C2 16, 16 2, 34 2" stroke="rgba(196,164,120,0.55)" strokeWidth="1.5" fill="none" />
      <path d="M6 34 C6 18, 18 6, 34 6" stroke="rgba(196,164,120,0.30)" strokeWidth="1" fill="none" />
      <circle cx="4" cy="32" r="2" fill="rgba(196,164,120,0.40)" />
      <circle cx="32" cy="4" r="2" fill="rgba(196,164,120,0.40)" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function ResultPage() {
  const router = useRouter();
  const user = getUser();
  const [data, setData] = useState<ResultData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitingImage, setWaitingImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }

    apiFetch<ResultData>("/api/v1/result/image")
      .then((res) => {
        setData(res);
        if (!res.resultImageUrl) setWaitingImage(true);
        if (res.spinLog) setShowConfetti(true);
      })
      .catch(() => setData({ resultImageUrl: null, shareUrl: null, caption: null, spinLog: null }))
      .finally(() => setLoading(false));

    const token = getToken();
    const socket = getSocket(token || undefined);
    socket.on("image_ready", (ev: any) => {
      if (ev.userId === user.id && ev.type === "result") {
        setData((prev) => prev ? { ...prev, resultImageUrl: ev.imageUrl } : prev);
        setWaitingImage(false);
      }
    });

    return () => { socket.off("image_ready"); };
  }, [router, user]);

  const getResultImageFullUrl = useCallback(() => {
    if (!data?.resultImageUrl) return null;
    return getApiUrl(data.resultImageUrl);
  }, [data]);

  const handleShare = useCallback(async () => {
    const imgUrl = getResultImageFullUrl();
    if (!imgUrl) return;
    setSharing(true);
    try {
      if (navigator.share) {
        const res = await fetch(imgUrl);
        const blob = await res.blob();
        const file = new File([blob], "womanday_result.jpg", { type: "image/jpeg" });
        await navigator.share({
          title: "Chúc Mừng 8/3",
          text: data?.caption || "Chúc mừng Ngày Phụ Nữ Quốc Tế!",
          files: [file],
        });
      } else {
        await handleDownload();
      }
    } catch { /* cancelled */ } finally {
      setSharing(false);
    }
  }, [data, getResultImageFullUrl]);

  async function handleDownload() {
    const imgUrl = getResultImageFullUrl();
    if (!imgUrl) return;
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "womanday_result.jpg";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imgUrl, "_blank");
    }
  }

  async function handleCopyCaption() {
    if (!data?.caption) return;
    await navigator.clipboard.writeText(data.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-pink">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-brand-deep/40 text-lg font-light tracking-wide italic"
        >
          Đang tải kết quả...
        </motion.div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ").slice(-1)[0] || "";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-5 bg-brand-pink relative overflow-hidden">
      {/* Floating petals background */}
      <FloatingPetals />

      {/* Confetti burst */}
      <AnimatePresence>{showConfetti && <ConfettiBurst />}</AnimatePresence>

      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full bg-white/25 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-blush/40 blur-[100px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-[300px] h-[300px] rounded-full bg-brand-hot/8 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* ── Decorative header ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-4"
        >
          {/* Floral ornament top */}
          <div className="text-brand-deep/15 text-xs tracking-[0.5em] mb-1">
            ✿ ✿ ✿
          </div>
          <h1 className="text-2xl font-bold text-brand-deep tracking-wide italic">
            Chúc Mừng {firstName}!
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-brand-gold/40" />
            <span className="text-brand-deep/25 text-[10px] tracking-[0.3em] uppercase font-light">
              Ngày Phụ Nữ 8/3
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-brand-gold/40" />
          </div>
        </motion.div>

        {/* ── Result image in gold frame ───────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
          className="relative mb-3"
        >
          {/* Gold frame container */}
          <div className="envelope-card p-2.5 relative">
            {/* Gold corner ornaments */}
            <GoldCorner className="absolute top-1.5 left-1.5" />
            <GoldCorner className="absolute top-1.5 right-1.5 -scale-x-100" />
            <GoldCorner className="absolute bottom-1.5 left-1.5 -scale-y-100" />
            <GoldCorner className="absolute bottom-1.5 right-1.5 scale-x-[-1] scale-y-[-1]" />

            {waitingImage ? (
              <div className="aspect-[1080/1350] flex flex-col items-center justify-center bg-brand-cream rounded-xl gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-8 h-8 border-2 border-brand-hot/50 border-t-transparent rounded-full"
                />
                <p className="text-brand-deep/35 text-sm font-light italic">Đang tạo ảnh...</p>
              </div>
            ) : data?.resultImageUrl ? (
              <img
                src={getApiUrl(data.resultImageUrl)}
                alt="Ảnh kết quả"
                className="w-full rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<div class="aspect-[1080/1350] flex items-center justify-center bg-brand-cream rounded-xl"><p class="text-brand-deep/25 text-sm font-light italic">Ảnh chưa sẵn sàng...</p></div>';
                }}
              />
            ) : (
              <div className="aspect-[1080/1350] flex items-center justify-center bg-brand-cream rounded-xl">
                <p className="text-brand-deep/20 text-sm font-light italic">Ảnh đang được tạo...</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Action buttons ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="space-y-2.5"
        >
          <button
            onClick={handleShare}
            disabled={!data?.resultImageUrl || sharing}
            className="w-full relative overflow-hidden bg-gradient-to-r from-brand-hot via-brand-rose to-brand-mauve text-white font-bold py-3 rounded-2xl active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-30 shadow-lg shadow-brand-hot/20"
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%] pointer-events-none" />
            <svg className="w-5 h-5 flex-shrink-0 relative" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="relative">{sharing ? "Đang chia sẻ..." : "CHIA SẺ ẢNH"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!data?.resultImageUrl}
            className="w-full glass text-brand-deep font-bold py-3 rounded-2xl hover:bg-white/80 active:scale-[0.98] transition-all duration-300 disabled:opacity-30"
          >
            TẢI ẢNH VỀ
          </button>
        </motion.div>

        {/* ── Caption ──────────────────────────────────── */}
        {data?.caption && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="gold-frame p-4 mt-3"
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-brand-deep/40 text-[10px] font-light uppercase tracking-[0.2em]">Caption gợi ý</p>
              <button
                onClick={handleCopyCaption}
                className="text-brand-hot text-xs font-medium hover:text-brand-hot/70 transition-colors"
              >
                {copied ? "Đã copy ✓" : "Copy"}
              </button>
            </div>
            <p className="text-brand-deep/65 text-sm leading-relaxed italic font-light">{data.caption}</p>
          </motion.div>
        )}

        {/* ── Footer ───────────────────────────────────── */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-px w-8 bg-brand-deep/10" />
            <span className="text-brand-deep/20 text-lg">🌸</span>
            <div className="h-px w-8 bg-brand-deep/10" />
          </div>
          <p className="text-brand-deep/20 text-[10px] font-light tracking-[0.2em] uppercase">
            Chúc mừng Ngày Phụ Nữ Quốc Tế 8/3/2026
          </p>
        </div>
      </div>
    </div>
  );
}
