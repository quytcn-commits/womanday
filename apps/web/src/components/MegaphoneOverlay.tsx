"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Socket } from "socket.io-client";

interface MegaphoneAnnouncement {
  id: string;
  megaphoneType: "small" | "big";
  user: { userId: string; name: string; dept: string };
  message: string;
  createdAt: string;
}

interface ActiveItem extends MegaphoneAnnouncement {
  expiresAt: number;
}

interface Props {
  socket: Socket | null;
}

const FIREWORK_EMOJIS = ["✨", "🌸", "💫", "🎀", "⭐", "🌟", "💖", "🎉", "🌷", "💐"];
const PARTICLE_COUNT = 24;
const WAVE2_COUNT = 14;

export default function MegaphoneOverlay({ socket }: Props) {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const cleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for megaphone_announcement events
  useEffect(() => {
    if (!socket) return;
    const handler = (data: MegaphoneAnnouncement) => {
      const duration = data.megaphoneType === "big" ? 6000 : 4000;
      setActiveItems((prev) => {
        let next = [...prev];
        if (data.megaphoneType === "small") {
          const smalls = next.filter((i) => i.megaphoneType === "small");
          if (smalls.length >= 4) next = next.filter((i) => i.id !== smalls[0].id);
        } else {
          const bigs = next.filter((i) => i.megaphoneType === "big");
          if (bigs.length >= 2) next = next.filter((i) => i.id !== bigs[0].id);
        }
        return [...next, { ...data, expiresAt: Date.now() + duration }];
      });
    };
    socket.on("megaphone_announcement", handler);
    return () => { socket.off("megaphone_announcement", handler); };
  }, [socket]);

  // Cleanup expired items every 500ms
  useEffect(() => {
    cleanupRef.current = setInterval(() => {
      setActiveItems((prev) => {
        const now = Date.now();
        const filtered = prev.filter((i) => i.expiresAt > now);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 500);
    return () => { if (cleanupRef.current) clearInterval(cleanupRef.current); };
  }, []);

  const smalls = activeItems.filter((i) => i.megaphoneType === "small");
  const bigs = activeItems.filter((i) => i.megaphoneType === "big");

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {/* Big megaphone overlay — light transparent bg */}
      <AnimatePresence>
        {bigs.length > 0 && (
          <motion.div
            key="big-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
            style={{
              background: "rgba(255,245,247,0.35)",
              backdropFilter: "blur(4px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Big megaphone messages + fireworks */}
      <AnimatePresence>
        {bigs.map((item, idx) => (
          <BigMegaphoneFirework
            key={item.id}
            data={item}
            stackOffset={bigs.length > 1 ? (idx === 0 ? -70 : 70) : 0}
          />
        ))}
      </AnimatePresence>

      {/* Small megaphone toasts — stacked right */}
      <AnimatePresence>
        {smalls.map((item, idx) => (
          <SmallMegaphoneToast key={item.id} data={item} index={idx} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Small Megaphone Toast ─────────────────────────────── */

function SmallMegaphoneToast({ data, index }: { data: ActiveItem; index: number }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");

  return (
    <motion.div
      initial={{ x: "110%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "110%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      className="absolute right-3"
      style={{ top: `${80 + index * 90}px` }}
    >
      <div
        className="w-72 py-3 px-4 rounded-2xl border border-brand-hot/15"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 4px 24px rgba(232,96,122,0.15), 0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <motion.span
            className="text-2xl flex-shrink-0"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            📢
          </motion.span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-brand-deep font-bold text-xs">{shortName}</span>
              <span className="text-brand-rose/40 text-[10px]">{data.user.dept}</span>
            </div>
            <p className="text-brand-deep/80 font-semibold text-sm leading-snug line-clamp-2 mt-0.5">
              {data.message}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Big Megaphone with Firework ───────────────────────── */

function BigMegaphoneFirework({ data, stackOffset }: { data: ActiveItem; stackOffset: number }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");
  // Pre-compute particles to keep them stable across re-renders
  const particlesRef = useRef(generateParticles());
  const wave2Ref = useRef(generateWave2());

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {/* Firework particles — wave 1 (burst from center) */}
      <div className="absolute inset-0 overflow-hidden">
        {particlesRef.current.map((p, i) => (
          <motion.span
            key={`w1-${i}`}
            className="absolute text-lg sm:text-xl"
            style={{ left: "50%", top: `calc(50% + ${stackOffset}px)` }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.4, 0.6],
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          >
            {p.emoji}
          </motion.span>
        ))}

        {/* Wave 2 — delayed burst, goes further */}
        {wave2Ref.current.map((p, i) => (
          <motion.span
            key={`w2-${i}`}
            className="absolute text-sm sm:text-base"
            style={{ left: "50%", top: `calc(50% + ${stackOffset}px)` }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0.8 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.2, 0.4],
              opacity: [0.8, 0.8, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>

      {/* Message card */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, y: stackOffset }}
        animate={{ scale: 1, opacity: 1, y: stackOffset }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="relative z-10 text-center max-w-[80%] sm:max-w-[65%]"
      >
        <div
          className="px-8 py-6 rounded-3xl"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 60px rgba(232,96,122,0.25), 0 2px 8px rgba(0,0,0,0.05)",
            border: "1px solid rgba(212,175,55,0.3)",
          }}
        >
          {/* Megaphone icon */}
          <motion.div
            className="text-5xl sm:text-6xl mb-3"
            animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
          >
            📣
          </motion.div>

          {/* User info */}
          <p className="text-brand-deep/50 text-xs font-light mb-1.5 tracking-wider uppercase">
            {shortName} · {data.user.dept}
          </p>

          {/* Gold divider */}
          <div
            className="w-32 h-0.5 mx-auto mb-3"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #D4AF37 30%, #E8607A 70%, transparent 100%)",
            }}
          />

          {/* Message — prominent text */}
          <motion.p
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-2xl sm:text-3xl font-black leading-tight"
            style={{
              color: "#C07828",
              textShadow: "0 0 20px rgba(192,120,40,0.2)",
            }}
          >
            {data.message}
          </motion.p>

          {/* Bottom divider */}
          <div
            className="w-32 h-0.5 mx-auto mt-3"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #E8607A 30%, #D4AF37 70%, transparent 100%)",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Particle generators ───────────────────────────────── */

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const distance = 140 + Math.random() * 180;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      emoji: FIREWORK_EMOJIS[i % FIREWORK_EMOJIS.length],
      duration: 1.4 + Math.random() * 0.8,
      delay: i * 0.04,
    };
  });
}

function generateWave2() {
  return Array.from({ length: WAVE2_COUNT }, (_, i) => {
    const angle = (i / WAVE2_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 250 + Math.random() * 150;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      emoji: FIREWORK_EMOJIS[(i + 3) % FIREWORK_EMOJIS.length],
      duration: 1.8 + Math.random() * 0.7,
      delay: 0.8 + i * 0.06,
    };
  });
}
