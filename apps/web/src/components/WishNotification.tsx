"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  wish: {
    from: { name: string; dept?: string };
    flower: string;
    message: string;
  };
  onDismiss: () => void;
}

export default function WishNotification({ wish, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, x: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 left-4 right-4 z-[60] flex justify-center pointer-events-none"
    >
      <div
        onClick={onDismiss}
        className="pointer-events-auto max-w-sm w-full bg-white/95 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-xl border border-brand-hot/10 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">{wish.flower}</span>
          <div className="flex-1 min-w-0">
            <p className="text-brand-deep font-semibold text-sm">
              {wish.from.name} gửi lời chúc
            </p>
            <p className="text-brand-deep/60 text-xs mt-0.5 font-light leading-relaxed truncate">
              &ldquo;{wish.message}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
