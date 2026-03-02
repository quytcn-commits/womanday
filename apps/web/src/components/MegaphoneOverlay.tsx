"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Socket } from "socket.io-client";

interface MegaphoneAnnouncement {
  id: string;
  megaphoneType: "small" | "big";
  user: { userId: string; name: string; dept: string };
  message: string;
  createdAt: string;
}

interface Props {
  socket: Socket | null;
}

export default function MegaphoneOverlay({ socket }: Props) {
  const [queue, setQueue] = useState<MegaphoneAnnouncement[]>([]);
  const [current, setCurrent] = useState<MegaphoneAnnouncement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for megaphone_announcement events
  useEffect(() => {
    if (!socket) return;
    const handler = (data: MegaphoneAnnouncement) => {
      setQueue((prev) => [...prev, data]);
    };
    socket.on("megaphone_announcement", handler);
    return () => { socket.off("megaphone_announcement", handler); };
  }, [socket]);

  // Process queue: show one at a time
  const processNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null);
        return prev;
      }
      const [next, ...rest] = prev;
      setCurrent(next);
      const duration = next.megaphoneType === "big" ? 8000 : 5000;
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        // Small delay before next item
        setTimeout(() => processNext(), 500);
      }, duration);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      processNext();
    }
  }, [queue, current, processNext]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      <AnimatePresence>
        {current && current.megaphoneType === "small" && (
          <SmallMegaphoneBanner key={current.id} data={current} />
        )}
        {current && current.megaphoneType === "big" && (
          <BigMegaphoneOverlay key={current.id} data={current} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SmallMegaphoneBanner({ data }: { data: MegaphoneAnnouncement }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="absolute top-1/2 right-0 -translate-y-1/2 w-[45%] pointer-events-none"
    >
      <div
        className="py-5 px-8 rounded-l-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(232,116,154,0.92) 0%, rgba(196,151,122,0.92) 100%)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 40px rgba(196,151,122,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <motion.span
            className="text-4xl flex-shrink-0"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
          >
            📢
          </motion.span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold text-sm">{shortName}</span>
              <span className="text-white/50 text-xs font-light">{data.user.dept}</span>
            </div>
            <p className="text-white font-semibold text-xl leading-tight line-clamp-2">
              {data.message}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BigMegaphoneOverlay({ data }: { data: MegaphoneAnnouncement }) {
  const shortName = data.user.name.split(" ").slice(-2).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        background: "rgba(26,11,20,0.75)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 12 }}
        className="text-center max-w-[75%] px-8"
      >
        {/* Megaphone icon */}
        <motion.div
          className="text-7xl mb-6"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -5, 5, 0],
          }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
        >
          📣
        </motion.div>

        {/* User info */}
        <p className="text-white/60 text-sm font-light mb-2 tracking-wider uppercase">
          {shortName} · {data.user.dept}
        </p>

        {/* Gold divider */}
        <div
          className="w-48 h-0.5 mx-auto mb-6"
          style={{
            background: "linear-gradient(90deg, transparent 0%, #D4AF37 30%, #C4977A 70%, transparent 100%)",
          }}
        />

        {/* Message — BIG text */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-black leading-tight"
          style={{
            color: "#D4AF37",
            textShadow: "0 0 30px rgba(212,175,55,0.4), 0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {data.message}
        </motion.p>

        {/* Bottom divider */}
        <div
          className="w-48 h-0.5 mx-auto mt-6"
          style={{
            background: "linear-gradient(90deg, transparent 0%, #C4977A 30%, #D4AF37 70%, transparent 100%)",
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute text-xl"
              style={{
                left: `${10 + (i * 7) % 80}%`,
                top: `${20 + (i * 11) % 60}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2 + (i % 3),
                delay: i * 0.3,
                repeat: Infinity,
              }}
            >
              {["✨", "🌟", "💫"][i % 3]}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
