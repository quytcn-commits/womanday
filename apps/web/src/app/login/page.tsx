"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [cccd, setCccd] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleDobChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Auto-format: strip non-digits, insert slashes → DD/MM/YYYY
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
    } else if (digits.length > 2) {
      formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    }
    setDob(formatted);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; token: string; employee: any }>(
        "/api/v1/auth/login",
        { method: "POST", body: JSON.stringify({ cccd, dob }), auth: false }
      );
      saveAuth(res.token, res.employee);
      if (res.employee.role === "admin") {
        router.push("/admin");
      } else if (!res.employee.selfieUrl) {
        router.push("/selfie");
      } else {
        router.push("/ready");
      }
    } catch (err: any) {
      setError(err.data?.message || "CCCD hoặc ngày sinh không đúng");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-pink relative overflow-hidden">
      {/* Ambient light blobs */}
      <div className="absolute top-16 left-8 w-72 h-72 rounded-full bg-white/25 blur-[80px]" />
      <div className="absolute bottom-16 right-8 w-96 h-96 rounded-full bg-brand-blush/50 blur-[90px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-white/20 blur-[100px]" />

      <div className="glass p-8 w-full max-w-sm relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌸</div>
          <h1 className="text-2xl font-bold text-brand-deep tracking-wide">Women&apos;s Day</h1>
          <p className="text-brand-hot text-lg font-semibold italic">8/3/2026 — Quay Thưởng</p>
          <p className="text-brand-deep/40 text-sm mt-1 font-light tracking-wider">Hệ thống nội bộ</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-brand-deep/60 text-sm mb-1.5 font-light tracking-wide">Số CCCD</label>
            <input
              type="text"
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              placeholder="Nhập số căn cước công dân"
              className="w-full bg-white/60 border border-brand-hot/15 rounded-2xl px-4 py-3.5 text-brand-deep placeholder-brand-deep/25 focus:outline-none focus:border-brand-hot/40 focus:bg-white/80 focus:shadow-[0_0_20px_rgba(232,96,122,0.08)] transition-all duration-300"
              required
              maxLength={12}
            />
          </div>

          <div>
            <label className="block text-brand-deep/60 text-sm mb-1.5 font-light tracking-wide">Ngày sinh</label>
            <input
              type="text"
              inputMode="numeric"
              value={dob}
              onChange={handleDobChange}
              placeholder="DD/MM/YYYY (ví dụ: 08/03/1992)"
              className="w-full bg-white/60 border border-brand-hot/15 rounded-2xl px-4 py-3.5 text-brand-deep placeholder-brand-deep/25 focus:outline-none focus:border-brand-hot/40 focus:bg-white/80 focus:shadow-[0_0_20px_rgba(232,96,122,0.08)] transition-all duration-300"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-hot via-brand-rose to-brand-mauve text-white font-bold py-3.5 rounded-2xl hover:shadow-[0_0_30px_rgba(232,96,122,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? "Đang đăng nhập..." : "ĐĂNG NHẬP"}
          </button>
        </form>

        <p className="text-center text-brand-deep/30 text-xs mt-6 font-light tracking-wider">
          Dùng CCCD và ngày sinh để đăng nhập
        </p>
      </div>
    </div>
  );
}
