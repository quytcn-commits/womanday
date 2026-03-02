"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FLOWERS = ["🌸", "🌹", "🌷", "🌺", "🌻", "🌼", "💐", "🪻", "🌿", "💮", "🏵️", "❀"];

export default function WishModal({ isOpen, onClose }: Props) {
  const [flower, setFlower] = useState("🌸");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!message.trim()) {
      setError("Vui long nhap loi chuc");
      return;
    }
    setSending(true);
    setError("");
    try {
      await apiFetch("/api/v1/wishes", {
        method: "POST",
        body: JSON.stringify({ flower, message: message.trim() }),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        setFlower("🌸");
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.data?.message || err.message || "Gui that bai, thu lai");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl p-5 shadow-xl"
          >
            {/* Handle bar (mobile) */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4 sm:hidden" />

            {sent ? (
              <div className="text-center py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10 }}
                  className="text-5xl mb-3"
                >
                  {flower}
                </motion.div>
                <p className="text-brand-deep font-bold">Da gui loi chuc!</p>
                <p className="text-brand-deep/40 text-xs mt-1 font-light">
                  Loi chuc se duoc gui den dong nghiep ngau nhien
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-brand-deep font-bold text-base text-center mb-4">
                  Gui Loi Chuc 8/3
                </h3>

                {/* Flower picker */}
                <p className="text-brand-deep/40 text-[10px] uppercase tracking-widest mb-2 font-light">
                  Chon hoa
                </p>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {FLOWERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFlower(f)}
                      className="aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-200"
                      style={{
                        background: flower === f ? "rgba(232,96,122,0.12)" : "rgba(139,58,80,0.04)",
                        border: flower === f ? "2px solid rgba(232,96,122,0.4)" : "2px solid transparent",
                        transform: flower === f ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Message input */}
                <p className="text-brand-deep/40 text-[10px] uppercase tracking-widest mb-2 font-light">
                  Loi chuc (toi da 100 ky tu)
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 100))}
                  placeholder="Chuc chi em ngay 8/3 vui ve, hanh phuc!"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-brand-deep/[0.03] border border-brand-deep/[0.08] text-brand-deep placeholder:text-brand-deep/25 focus:outline-none focus:border-brand-hot/30 resize-none font-light"
                  rows={3}
                />
                <p className="text-brand-deep/25 text-[10px] text-right mt-1">
                  {message.length}/100
                </p>

                {error && (
                  <p className="text-red-500 text-xs text-center mt-2">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-brand-deep/40 bg-brand-deep/[0.04] hover:bg-brand-deep/[0.08] transition-colors"
                  >
                    Huy
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-brand-hot to-brand-rose hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {sending ? "Dang gui..." : `Gui ${flower}`}
                  </button>
                </div>

                <p className="text-brand-deep/25 text-[10px] text-center mt-3 font-light">
                  Loi chuc se duoc gui ngau nhien den mot dong nghiep
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
