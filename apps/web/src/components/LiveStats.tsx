"use client";

import { motion } from "framer-motion";

interface PrizeTierStats {
  total: number;
  assigned: number;
  remaining: number;
  label?: string;
  color?: string;
}

interface Props {
  totalParticipants: number;
  spunCount: number;
  prizePool: Record<string, PrizeTierStats>;
}

const TIER_EMOJIS: Record<string, string> = {
  FIRST: "🏆", SECOND: "🥈", THIRD: "🥉", CONS: "🌸",
};
const DEFAULT_COLOR = "#D4708F";

export default function LiveStats({ totalParticipants, spunCount, prizePool }: Props) {
  const progress = totalParticipants > 0 ? (spunCount / totalParticipants) * 100 : 0;
  const tiers = Object.entries(prizePool);

  return (
    <div className="glass p-4">
      <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest mb-3">
        Tiến Độ Quay Thưởng
      </p>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-brand-hot font-black text-lg">{spunCount}</span>
          <span className="text-brand-deep/30 text-xs font-light">/ {totalParticipants} người</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-brand-deep/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #E8607A, #D4708F, #C4A478)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Prize tiers — dynamic */}
      <div className="space-y-2">
        {tiers.map(([tierKey, stats]) => {
          const color = stats.color || DEFAULT_COLOR;
          const label = stats.label || tierKey;
          const emoji = TIER_EMOJIS[tierKey] || "🎁";
          const exhausted = stats.remaining === 0 && stats.total > 0;
          return (
            <div
              key={tierKey}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{
                background: exhausted ? "rgba(200,200,200,0.08)" : `${color}08`,
                border: `1px solid ${exhausted ? "rgba(200,200,200,0.12)" : `${color}18`}`,
              }}
            >
              <span className="text-base">{emoji}</span>
              <div className="flex-1 min-w-0">
                <span
                  className="text-xs font-semibold"
                  style={{ color: exhausted ? "#999" : color }}
                >
                  {label}
                </span>
              </div>
              <div className="text-right">
                {exhausted ? (
                  <span className="text-[10px] font-semibold text-brand-deep/30">
                    Đã có chủ!
                  </span>
                ) : (
                  <span className="text-xs font-bold" style={{ color }}>
                    {stats.remaining}<span className="text-brand-deep/25 font-normal">/{stats.total}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
