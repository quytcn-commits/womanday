"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { getApiUrl, apiFetch } from "@/lib/api";

interface Props {
  userId: string;
  name: string;
  dept: string;
  cardImageUrl: string | null;
  likeCount: number;
  isLikedByMe: boolean;
}

export default function GalleryCard({ userId, name, dept, cardImageUrl, likeCount: initialCount, isLikedByMe: initialLiked }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);

  async function handleLike() {
    // Optimistic update
    setLiked(!liked);
    setCount((c) => liked ? c - 1 : c + 1);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 600);

    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/api/v1/gallery/${userId}/like`,
        { method: "POST" }
      );
      setLiked(res.liked);
      setCount(res.likeCount);
    } catch {
      // Revert on error
      setLiked(initialLiked);
      setCount(initialCount);
    }
  }

  const imgSrc = cardImageUrl ? getApiUrl(cardImageUrl) : null;

  return (
    <div className="break-inside-avoid mb-3">
      <div className="glass rounded-2xl overflow-hidden">
        {/* Card image */}
        {imgSrc && (
          <div className="relative">
            <img
              src={imgSrc}
              alt={`Thiep cua ${name}`}
              className="w-full"
              loading="lazy"
              style={{ aspectRatio: "4/5", objectFit: "cover" }}
            />
            {/* Gradient overlay at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16"
              style={{
                background: "linear-gradient(transparent, rgba(0,0,0,0.4))",
              }}
            />
            {/* Name overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
              <p className="text-white font-bold text-sm truncate drop-shadow-md">{name}</p>
              <p className="text-white/70 text-[10px] font-light truncate">{dept}</p>
            </div>
          </div>
        )}

        {/* Like button */}
        <div className="px-3 py-2 flex items-center justify-between">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
          >
            <motion.span
              animate={animating ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.4 }}
              className="text-lg"
            >
              {liked ? "❤️" : "🤍"}
            </motion.span>
            <span
              className="text-xs font-semibold transition-colors"
              style={{ color: liked ? "#E8607A" : "rgba(139,58,80,0.4)" }}
            >
              {count}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
