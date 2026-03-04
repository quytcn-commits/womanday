"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  seconds: number;
  label?: string;
  maxSeconds?: number;
}

export default function CountdownTimer({ seconds, label = "Quay sau", maxSeconds = 30 }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-brand-deep/50 text-sm font-light uppercase tracking-[0.25em]">{label}</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={seconds}
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="countdown-number"
        >
          {String(seconds).padStart(2, "0")}
        </motion.div>
      </AnimatePresence>
      <div className="w-48 h-1.5 bg-brand-hot/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #E8607A, #D4A88C, #FCD5E0)" }}
          animate={{ width: `${(seconds / maxSeconds) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}
