"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import GalleryCard from "@/components/GalleryCard";

interface CardData {
  userId: string;
  name: string;
  dept: string;
  cardImageUrl: string | null;
  likeCount: number;
  isLikedByMe: boolean;
}

interface Department {
  dept: string;
  count: number;
}

export default function GalleryPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCards = useCallback(
    async (pageNum: number, dept: string, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "20",
          ...(dept !== "all" ? { dept } : {}),
        });
        const res = await apiFetch<{ cards: CardData[]; totalPages: number }>(
          `/api/v1/gallery?${params}`
        );
        setCards((prev) => (append ? [...prev, ...res.cards] : res.cards));
        setTotalPages(res.totalPages);
      } catch {}
      setLoading(false);
      setLoadingMore(false);
    },
    []
  );

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    fetchCards(1, "all");
    apiFetch<{ departments: Department[] }>("/api/v1/gallery/departments")
      .then((res) => setDepartments(res.departments))
      .catch(() => {});
  }, [router, fetchCards]);

  function handleDeptFilter(dept: string) {
    setSelectedDept(dept);
    setPage(1);
    fetchCards(1, dept);
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCards(nextPage, selectedDept, true);
  }

  return (
    <div className="min-h-screen bg-brand-pink relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/20 blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-brand-blush/50 blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push("/ready")}
            className="w-9 h-9 rounded-full bg-white/50 flex items-center justify-center text-brand-deep/60 hover:bg-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-brand-deep font-bold text-lg">Gallery Thiep 8/3</h1>
            <p className="text-brand-deep/40 text-xs font-light">Tuong thiep cua tat ca chi em</p>
          </div>
        </div>

        {/* Department filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button
            onClick={() => handleDeptFilter("all")}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: selectedDept === "all" ? "rgba(232,96,122,0.15)" : "rgba(139,58,80,0.04)",
              color: selectedDept === "all" ? "#E8607A" : "rgba(139,58,80,0.5)",
              border: selectedDept === "all" ? "1px solid rgba(232,96,122,0.3)" : "1px solid transparent",
            }}
          >
            Tat ca
          </button>
          {departments.map((d) => (
            <button
              key={d.dept}
              onClick={() => handleDeptFilter(d.dept)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: selectedDept === d.dept ? "rgba(232,96,122,0.15)" : "rgba(139,58,80,0.04)",
                color: selectedDept === d.dept ? "#E8607A" : "rgba(139,58,80,0.5)",
                border: selectedDept === d.dept ? "1px solid rgba(232,96,122,0.3)" : "1px solid transparent",
              }}
            >
              {d.dept} ({d.count})
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <p className="text-brand-deep/40 animate-pulse font-light">Dang tai...</p>
          </div>
        )}

        {/* Masonry grid */}
        {!loading && cards.length > 0 && (
          <div
            className="columns-2 sm:columns-3 lg:columns-4 gap-3"
          >
            {cards.map((card) => (
              <GalleryCard key={card.userId} {...card} />
            ))}
          </div>
        )}

        {!loading && cards.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🖼️</div>
            <p className="text-brand-deep/40 font-light">Chua co thiep nao</p>
          </div>
        )}

        {/* Load more */}
        {page < totalPages && !loading && (
          <div className="flex justify-center mt-6 mb-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-2xl text-sm font-semibold text-brand-hot bg-brand-hot/10 hover:bg-brand-hot/20 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Dang tai..." : "Xem them"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
