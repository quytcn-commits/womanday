"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Socket } from "socket.io-client";

interface FlowerEvent {
  id: string;
  slotIndex: number;
  fromUser: { name: string; dept: string };
}

interface FloatingFlower {
  id: string;
  x: number; // percent from left
  emoji: string;
}

const FLOWER_EMOJIS = ["🌸", "🌹", "🌷", "🌺", "💐", "🌼"];
let flowerId = 0;

interface Props {
  socket: Socket | null;
  columns?: number;
}

export default function FlowerAnimation({ socket, columns = 4 }: Props) {
  const [flowers, setFlowers] = useState<FloatingFlower[]>([]);

  const spawnFlower = useCallback((slotIndex: number) => {
    const col = ((slotIndex - 1) % columns);
    const colWidth = 70 / columns;
    const xPercent = 15 + col * colWidth + (Math.random() - 0.5) * 10;

    const flower: FloatingFlower = {
      id: `flower-${++flowerId}`,
      x: Math.max(5, Math.min(95, xPercent)),
      emoji: FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)],
    };

    setFlowers((prev) => {
      // Max 8 concurrent, drop oldest if over
      const next = prev.length >= 8 ? prev.slice(1) : prev;
      return [...next, flower];
    });

    // Auto-remove after animation
    setTimeout(() => {
      setFlowers((prev) => prev.filter((f) => f.id !== flower.id));
    }, 2500);
  }, [columns]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: FlowerEvent) => {
      spawnFlower(data.slotIndex);
    };
    socket.on("flower_received", handler);
    return () => { socket.off("flower_received", handler); };
  }, [socket, spawnFlower]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 90 }}>
      <AnimatePresence>
        {flowers.map((f) => (
          <motion.span
            key={f.id}
            className="absolute text-2xl"
            style={{ left: `${f.x}%`, bottom: "10%" }}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{
              opacity: [1, 1, 0],
              y: [0, -200, -350],
              scale: [0.5, 1.2, 0.8],
              x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          >
            {f.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
