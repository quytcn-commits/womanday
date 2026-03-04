"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

// ── Limits ────────────────────────────────────
const MAX_SMALL_VISIBLE = 3;
const MAX_BIG_VISIBLE = 1;
const THROTTLE_MS = 500;         // Min gap between showing new items
const SMALL_DURATION = 4000;
const SMALL_DURATION_BUSY = 2500; // Shorter when queue is backing up
const BIG_DURATION = 5000;
const BIG_DURATION_BUSY = 3000;
const PARTICLE_LIGHT = 12;       // Normal particle count
const PARTICLE_HEAVY = 6;        // Reduced when under load

export default function MegaphoneOverlay({ socket }: Props) {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const bufferRef = useRef<MegaphoneAnnouncement[]>([]);
  const lastShowRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for megaphone_announcement — buffer all incoming
  useEffect(() => {
    if (!socket) return;
    const handler = (data: MegaphoneAnnouncement) => {
      bufferRef.current.push(data);
    };
    socket.on("megaphone_announcement", handler);
    return () => { socket.off("megaphone_announcement", handler); };
  }, [socket]);

  // Tick every 300ms: promote buffered items + cleanup expired
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const now = Date.now();

      setActiveItems((prev) => {
        // 1. Remove expired
        let next = prev.filter((i) => i.expiresAt > now);

        // 2. Throttle: only add new if enough time passed
        if (bufferRef.current.length > 0 && now - lastShowRef.current >= THROTTLE_MS) {
          const item = bufferRef.current.shift()!;
          const busy = bufferRef.current.length > 3;
          const duration = item.megaphoneType === "big"
            ? (busy ? BIG_DURATION_BUSY : BIG_DURATION)
            : (busy ? SMALL_DURATION_BUSY : SMALL_DURATION);

          // Enforce concurrent limits — drop oldest of same type
          if (item.megaphoneType === "small") {
            const smalls = next.filter((i) => i.megaphoneType === "small");
            if (smalls.length >= MAX_SMALL_VISIBLE) {
              next = next.filter((i) => i.id !== smalls[0].id);
            }
          } else {
            const bigs = next.filter((i) => i.megaphoneType === "big");
            if (bigs.length >= MAX_BIG_VISIBLE) {
              next = next.filter((i) => i.id !== bigs[0].id);
            }
          }

          next.push({ ...item, expiresAt: now + duration });
          lastShowRef.current = now;
        }

        // 3. Cap total buffer to prevent memory buildup (keep newest 30)
        if (bufferRef.current.length > 30) {
          bufferRef.current = bufferRef.current.slice(-30);
        }

        return next.length === prev.length && !bufferRef.current.length ? prev : next;
      });
    }, 300);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const smalls = activeItems.filter((i) => i.megaphoneType === "small");
  const bigs = activeItems.filter((i) => i.megaphoneType === "big");
  const pendingCount = bufferRef.current.length;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {/* Big megaphone overlay — very light bg */}
      <AnimatePresence>
        {bigs.length > 0 && (
          <motion.div
            key="big-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
            style={{
              background: "rgba(255,245,247,0.3)",
              backdropFilter: "blur(3px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Big megaphone message + fireworks */}
      <AnimatePresence mode="wait">
        {bigs.map((item) => (
          <BigMegaphoneFirework
            key={item.id}
            data={item}
            lightMode={pendingCount > 3}
          />
        ))}
      </AnimatePresence>

      {/* Small megaphone toasts — stacked right */}
      <AnimatePresence>
        {smalls.map((item, idx) => (
          <SmallMegaphoneToast key={item.id} data={item} index={idx} />
        ))}
      </AnimatePresence>

      {/* Pending counter — shows when buffer is backing up */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <PendingBadge count={pendingCount} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Pending Badge ────────────────────────────────────── */

function PendingBadge({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="absolute top-4 right-4 px-3 py-1.5 rounded-full"
      style={{
        background: "rgba(232,96,122,0.9)",
        boxShadow: "0 2px 12px rgba(232,96,122,0.4)",
      }}
    >
      <span className="text-white text-xs font-bold">
        📢 +{count} lời chúc
      </span>
    </motion.div>
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
      style={{ top: `${80 + index * 82}px` }}
    >
      <div
        className="w-64 sm:w-72 py-3 px-4 rounded-2xl border border-brand-hot/15"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 4px 24px rgba(232,96,122,0.12), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📢</span>
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

function BigMegaphoneFirework({ data, lightMode }: { data: ActiveItem; lightMode: boolean }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");
  const particleCount = lightMode ? PARTICLE_HEAVY : PARTICLE_LIGHT;

  // Pre-compute particles (stable across re-renders)
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distance = 120 + Math.random() * 160;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        emoji: FIREWORK_EMOJIS[i % FIREWORK_EMOJIS.length],
        duration: 1.2 + Math.random() * 0.6,
        delay: i * 0.05,
      };
    });
  }, [particleCount]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {/* Firework particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <motion.span
            key={i}
            className="absolute text-base sm:text-lg"
            style={{ left: "50%", top: "50%" }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.3, 0.5],
              opacity: [1, 0.9, 0],
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
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 130, damping: 16 }}
        className="relative z-10 text-center max-w-[80%] sm:max-w-[60%]"
      >
        <div
          className="px-6 py-5 sm:px-8 sm:py-6 rounded-3xl"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 48px rgba(232,96,122,0.2), 0 2px 8px rgba(0,0,0,0.04)",
            border: "1px solid rgba(212,175,55,0.25)",
          }}
        >
          {/* Megaphone icon */}
          <motion.div
            className="text-4xl sm:text-5xl mb-2"
            animate={{ scale: [1, 1.2, 1], rotate: [0, -6, 6, 0] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
          >
            📣
          </motion.div>

          {/* User info */}
          <p className="text-brand-deep/50 text-xs font-light mb-1 tracking-wider uppercase">
            {shortName} · {data.user.dept}
          </p>

          {/* Gold divider */}
          <div
            className="w-28 h-0.5 mx-auto mb-2"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #D4AF37 30%, #E8607A 70%, transparent 100%)",
            }}
          />

          {/* Message */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="text-xl sm:text-2xl font-black leading-tight"
            style={{
              color: "#C07828",
              textShadow: "0 0 16px rgba(192,120,40,0.15)",
            }}
          >
            {data.message}
          </motion.p>

          {/* Bottom divider */}
          <div
            className="w-28 h-0.5 mx-auto mt-2"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #E8607A 30%, #D4AF37 70%, transparent 100%)",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
