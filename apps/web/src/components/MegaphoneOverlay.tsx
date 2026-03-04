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

const FIREWORK_EMOJIS = ["✨", "🌸", "💫", "🎀", "⭐", "🌟", "💖", "🎉", "🌷", "💐", "🎊", "💝"];

// ── Limits ────────────────────────────────────
const MAX_SMALL_VISIBLE = 3;
const MAX_BIG_VISIBLE = 1;
const THROTTLE_MS = 500;
const SMALL_DURATION = 5000;
const SMALL_DURATION_BUSY = 3000;
const BIG_DURATION = 6000;
const BIG_DURATION_BUSY = 4000;
const PARTICLE_NORMAL = 20;
const PARTICLE_BUSY = 10;

export default function MegaphoneOverlay({ socket }: Props) {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const bufferRef = useRef<MegaphoneAnnouncement[]>([]);
  const lastShowRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: MegaphoneAnnouncement) => {
      bufferRef.current.push(data);
    };
    socket.on("megaphone_announcement", handler);
    return () => { socket.off("megaphone_announcement", handler); };
  }, [socket]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      const now = Date.now();

      setActiveItems((prev) => {
        let next = prev.filter((i) => i.expiresAt > now);

        if (bufferRef.current.length > 0 && now - lastShowRef.current >= THROTTLE_MS) {
          const item = bufferRef.current.shift()!;
          const busy = bufferRef.current.length > 3;
          const duration = item.megaphoneType === "big"
            ? (busy ? BIG_DURATION_BUSY : BIG_DURATION)
            : (busy ? SMALL_DURATION_BUSY : SMALL_DURATION);

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
      {/* Big megaphone — NO backdrop-blur, just very subtle tint */}
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
              background: "radial-gradient(ellipse at center, rgba(255,220,230,0.25) 0%, rgba(255,245,247,0.08) 60%, transparent 100%)",
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

      {/* Pending counter */}
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
      className="absolute top-3 right-3 px-3 py-1.5 rounded-full"
      style={{
        background: "linear-gradient(135deg, #E8607A, #D4708F)",
        boxShadow: "0 2px 12px rgba(232,96,122,0.5), 0 0 20px rgba(232,96,122,0.2)",
      }}
    >
      <span className="text-white text-xs font-bold tracking-wide">
        +{count} lời chúc
      </span>
    </motion.div>
  );
}

/* ── Small Megaphone Toast ─────────────────────────────── */

function SmallMegaphoneToast({ data, index }: { data: ActiveItem; index: number }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");

  return (
    <motion.div
      initial={{ x: "120%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "120%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 22 }}
      className="absolute right-3"
      style={{ top: `max(env(safe-area-inset-top, 0px) + ${56 + index * 68}px, ${56 + index * 68}px)` }}
    >
      <div
        className="w-60 sm:w-68 py-2.5 px-3.5 rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 20px rgba(232,96,122,0.15), 0 1px 3px rgba(0,0,0,0.05)",
          borderLeft: "3px solid #E8607A",
          borderTop: "1px solid rgba(232,96,122,0.08)",
          borderRight: "1px solid rgba(232,96,122,0.08)",
          borderBottom: "1px solid rgba(232,96,122,0.08)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0 mt-0.5">📢</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-brand-deep font-bold text-[11px]">{shortName}</span>
              <span className="text-brand-rose/50 text-[9px] font-medium">{data.user.dept}</span>
            </div>
            <p className="text-brand-deep/80 font-semibold text-[13px] leading-snug line-clamp-2 mt-0.5">
              {data.message}
            </p>
          </div>
        </div>
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.5, delay: 0.3, ease: "easeInOut" }}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            width: "40%",
          }}
        />
      </div>
    </motion.div>
  );
}

/* ── Big Megaphone with Firework ───────────────────────── */

function BigMegaphoneFirework({ data, lightMode }: { data: ActiveItem; lightMode: boolean }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");
  const particleCount = lightMode ? PARTICLE_BUSY : PARTICLE_NORMAL;

  // Wave 1: main burst
  const wave1 = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 180 + Math.random() * 220;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        emoji: FIREWORK_EMOJIS[i % FIREWORK_EMOJIS.length],
        size: 20 + Math.random() * 12,
        duration: 1.8 + Math.random() * 0.8,
        delay: i * 0.04,
        rotation: Math.random() * 360,
      };
    });
  }, [particleCount]);

  // Wave 2: delayed secondary burst (fewer, larger, farther)
  const wave2 = useMemo(() => {
    const count = Math.max(Math.floor(particleCount * 0.5), 4);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const distance = 250 + Math.random() * 300;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        emoji: FIREWORK_EMOJIS[(i + 3) % FIREWORK_EMOJIS.length],
        size: 24 + Math.random() * 14,
        duration: 2.0 + Math.random() * 1.0,
        delay: 0.6 + i * 0.06,
        rotation: Math.random() * 360,
      };
    });
  }, [particleCount]);

  // Sparkle ring around the card
  const sparkles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 140 + Math.random() * 40;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        delay: 0.3 + i * 0.08,
      };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {/* Firework Wave 1 — main burst */}
      <div className="absolute inset-0 overflow-hidden">
        {wave1.map((p, i) => (
          <motion.span
            key={`w1-${i}`}
            className="absolute"
            style={{ left: "50%", top: "50%", fontSize: `${p.size}px` }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.4, 0.6, 0],
              opacity: [0, 1, 0.8, 0],
              rotate: p.rotation,
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

      {/* Firework Wave 2 — delayed secondary burst */}
      <div className="absolute inset-0 overflow-hidden">
        {wave2.map((p, i) => (
          <motion.span
            key={`w2-${i}`}
            className="absolute"
            style={{ left: "50%", top: "50%", fontSize: `${p.size}px` }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.6, 0.4, 0],
              opacity: [0, 1, 0.7, 0],
              rotate: p.rotation,
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

      {/* Sparkle ring — subtle glowing dots around card */}
      {sparkles.map((s, i) => (
        <motion.div
          key={`spark-${i}`}
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: 6,
            height: 6,
            background: "radial-gradient(circle, #FFD700 0%, #E8607A 80%, transparent 100%)",
            boxShadow: "0 0 8px 3px rgba(255,215,0,0.5)",
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{
            x: s.x,
            y: s.y,
            scale: [0, 2, 1.2, 0],
            opacity: [0, 1, 0.6, 0],
          }}
          transition={{
            duration: 2,
            delay: s.delay,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Message card — glass with animated border glow */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: -20 }}
        transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.05 }}
        className="relative z-10 text-center max-w-[85%] sm:max-w-[55%]"
      >
        {/* Outer glow */}
        <div
          className="absolute -inset-1 rounded-[28px] opacity-60"
          style={{
            background: "linear-gradient(135deg, #FFD700 0%, #E8607A 50%, #D4AF37 100%)",
            filter: "blur(8px)",
          }}
        />

        {/* Card */}
        <div
          className="relative px-7 py-5 sm:px-10 sm:py-7 rounded-3xl"
          style={{
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 8px 40px rgba(232,96,122,0.25), 0 0 60px rgba(255,215,0,0.12), 0 2px 6px rgba(0,0,0,0.03)",
            border: "1.5px solid rgba(212,175,55,0.35)",
          }}
        >
          {/* Shimmer sweep across card */}
          <motion.div
            className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "300%" }}
              transition={{ duration: 2, delay: 0.3, ease: "easeInOut", repeat: 1, repeatDelay: 1 }}
              style={{
                position: "absolute",
                inset: 0,
                width: "30%",
                background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.15), transparent)",
              }}
            />
          </motion.div>

          {/* Megaphone icon with bounce */}
          <motion.div
            className="text-4xl sm:text-5xl mb-3"
            animate={{
              scale: [1, 1.25, 1],
              rotate: [0, -8, 8, -4, 0],
            }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.5 }}
          >
            📣
          </motion.div>

          {/* User info */}
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xs font-medium mb-2 tracking-widest uppercase"
            style={{ color: "#D4708F" }}
          >
            {shortName} · {data.user.dept}
          </motion.p>

          {/* Gold divider — thicker, wider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
            className="w-32 h-[2px] mx-auto mb-3"
            style={{
              background: "linear-gradient(90deg, transparent, #D4AF37 25%, #E8607A 75%, transparent)",
            }}
          />

          {/* Message — large, gold, punchy */}
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.35 }}
            className="text-xl sm:text-2xl md:text-[26px] font-black leading-snug"
            style={{
              background: "linear-gradient(135deg, #B8860B 0%, #C07828 40%, #D4AF37 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 1px 2px rgba(192,120,40,0.2))",
            }}
          >
            {data.message}
          </motion.p>

          {/* Bottom divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
            className="w-32 h-[2px] mx-auto mt-3"
            style={{
              background: "linear-gradient(90deg, transparent, #E8607A 25%, #D4AF37 75%, transparent)",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
