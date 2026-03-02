"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Socket } from "socket.io-client";

interface Winner {
  name: string;
  dept: string;
  tier: string;
  value: number;
  isHighTier: boolean;
  spunAt: string;
}

interface Props {
  socket: Socket | null;
  initialWinners?: Winner[];
}

const TIER_COLORS: Record<string, string> = {
  FIRST: "#B8860B",
  SECOND: "#6B6B78",
  THIRD: "#A0603C",
  CONS: "#B03060",
};

const TIER_EMOJI: Record<string, string> = {
  FIRST: "🏆",
  SECOND: "🥈",
  THIRD: "🥉",
  CONS: "🌸",
};

function formatValue(v: number) {
  return v.toLocaleString("vi-VN") + "d";
}

export default function WinnerFeed({ socket, initialWinners = [] }: Props) {
  const [winners, setWinners] = useState<Winner[]>(initialWinners);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: Winner) => {
      setWinners((prev) => [data, ...prev].slice(0, 20));
    };

    socket.on("winner_announced", handler);
    return () => { socket.off("winner_announced", handler); };
  }, [socket]);

  if (winners.length === 0) return null;

  const visible = expanded ? winners : winners.slice(0, 3);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest">
          Nguoi Trung Thuong
        </p>
        {winners.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-brand-hot text-[10px] font-semibold hover:text-brand-hot/70 transition-colors"
          >
            {expanded ? "Thu gon" : `Xem tat ca (${winners.length})`}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((w, i) => (
            <motion.div
              key={w.spunAt + w.name + i}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
              style={{
                background: w.isHighTier ? `${TIER_COLORS[w.tier]}0A` : "rgba(0,0,0,0.02)",
                border: w.isHighTier ? `1px solid ${TIER_COLORS[w.tier]}20` : "1px solid transparent",
              }}
            >
              <span className={w.isHighTier ? "text-lg" : "text-sm"}>
                {TIER_EMOJI[w.tier] || "🌸"}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`truncate ${w.isHighTier ? "font-bold text-sm" : "font-medium text-xs"}`}
                  style={{ color: TIER_COLORS[w.tier] || "#8B3A50" }}
                >
                  {w.name}
                </p>
                <p className="text-brand-deep/30 text-[10px] font-light truncate">{w.dept}</p>
              </div>
              <span
                className={`font-bold whitespace-nowrap ${w.isHighTier ? "text-sm" : "text-xs"}`}
                style={{ color: TIER_COLORS[w.tier] }}
              >
                {formatValue(w.value)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
