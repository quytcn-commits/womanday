"use client";

import { motion } from "framer-motion";

interface Props {
  isSpinning: boolean;
}

const PETAL_COLORS = ["#E8607A", "#D4708F", "#D4A88C", "#FFF0F5", "#C06A82", "#FCD5E0"];

export default function SpinAnimation({ isSpinning }: Props) {
  if (!isSpinning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {/* Rotating rose beams */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <motion.div
          key={deg}
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: [deg, deg + 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="w-0.5 h-full"
            style={{
              background: "linear-gradient(to top, transparent 0%, rgba(232,96,122,0.12) 40%, rgba(212,168,140,0.08) 60%, transparent 100%)",
              transformOrigin: "50% 50%",
            }}
          />
        </motion.div>
      ))}

      {/* Center rose glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-48 h-48 rounded-full blur-[60px]"
          style={{ background: "radial-gradient(circle, rgba(232,96,122,0.15) 0%, rgba(212,168,140,0.08) 50%, transparent 100%)" }}
        />
      </motion.div>

      {/* Floating petal particles */}
      {Array.from({ length: 16 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${8 + (i * 5.5) % 84}%`,
            top: `${10 + (i * 7.3) % 80}%`,
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            backgroundColor: PETAL_COLORS[i % PETAL_COLORS.length],
          }}
          animate={{
            y: [0, -25 - (i % 3) * 10, 0],
            opacity: [0, 0.7, 0],
            scale: [0, 1.2, 0],
          }}
          transition={{
            duration: 1.8 + (i % 4) * 0.4,
            repeat: Infinity,
            delay: (i * 0.25) % 2,
          }}
        />
      ))}
    </div>
  );
}
