"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiUpload, apiFetch, getApiUrl } from "@/lib/api";
import { getUser, updateUser } from "@/lib/auth";

const FALLBACK_COLORS = ["from-brand-hot/50 to-brand-rose/30", "from-brand-rose/50 to-brand-gold/30", "from-brand-mauve/50 to-brand-hot/30"];

interface TemplateOption { id: number; name: string; previewUrl: string | null; }

export default function SelfiePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(1);
  const [templates, setTemplates] = useState<TemplateOption[]>([
    { id: 1, name: "Hoa Anh Đào", previewUrl: null },
    { id: 2, name: "Hoa Hồng Vàng", previewUrl: null },
    { id: 3, name: "Tím Thanh Lịch", previewUrl: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "preview">("upload");

  useEffect(() => {
    const user = getUser();
    if (!user) { router.push("/login"); return; }
    apiFetch<{ templates: TemplateOption[] }>("/api/v1/selfie/templates", { auth: false })
      .then(({ templates: tpls }) => setTemplates(tpls))
      .catch(() => {});
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Vui lòng chọn file ảnh"); return; }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("preview");
    setError("");
  };

  async function handleSubmit() {
    if (!selectedFile) { setError("Vui lòng chọn ảnh selfie"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("template_id", String(templateId));
      const res = await apiUpload<{ success: boolean; selfieUrl: string; cardImageUrl: string | null; greeting: string | null }>(
        "/api/v1/selfie/upload",
        formData
      );
      updateUser({ selfieUrl: res.selfieUrl, cardImageUrl: res.cardImageUrl, cardTemplateId: templateId, greeting: res.greeting ?? null });
      router.push("/ready");
    } catch (err: any) {
      setError(err.message || "Upload thất bại, thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8 bg-brand-pink relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[350px] rounded-full bg-white/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[350px] h-[300px] rounded-full bg-brand-blush/50 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6 animate-fade-in">
          <div className="text-4xl mb-2">🌸</div>
          <h1 className="text-xl font-bold text-brand-deep tracking-wide">Chụp Ảnh & Tạo Thiệp</h1>
          <p className="text-brand-rose/50 text-sm mt-1 font-light tracking-wider">Bước 1/2</p>
        </div>

        <div
          className="glass p-6 mb-4 cursor-pointer hover:border-brand-hot/30 hover:shadow-[0_4px_30px_rgba(232,96,122,0.12)] transition-all duration-300"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <div className="relative">
              <img src={previewUrl} alt="Preview" className="w-full aspect-square object-cover rounded-2xl" />
              <div className="absolute inset-0 flex items-center justify-center bg-brand-deep/30 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300">
                <span className="text-white text-sm font-semibold">Đổi ảnh</span>
              </div>
            </div>
          ) : (
            <div className="aspect-square flex flex-col items-center justify-center text-brand-rose/40 gap-3 border-2 border-dashed border-brand-hot/20 rounded-2xl">
              <span className="text-5xl">🌸</span>
              <p className="text-sm font-light text-brand-deep/50">Nhấn để chọn ảnh selfie</p>
              <p className="text-xs text-brand-rose/30 font-light">JPG/PNG, tối đa 3MB</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {step === "preview" && (
          <div className="glass p-4 mb-4 animate-fade-in">
            <p className="text-brand-deep/70 text-sm mb-3 font-semibold tracking-wide">Chọn template thiệp</p>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`relative rounded-2xl overflow-hidden text-xs font-semibold text-center transition-all duration-300 ${
                    templateId === t.id
                      ? "ring-2 ring-brand-hot ring-offset-2 ring-offset-white scale-105 shadow-[0_4px_20px_rgba(232,96,122,0.25)]"
                      : "opacity-60 hover:opacity-90"
                  }`}
                >
                  {t.previewUrl ? (
                    <div className="relative aspect-[3/4]">
                      <img src={getApiUrl(t.previewUrl)} alt={t.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-brand-deep/70 to-transparent py-1.5 text-white text-[10px]">
                        {t.name}
                      </div>
                    </div>
                  ) : (
                    <div className={`py-3 px-2 bg-gradient-to-br ${FALLBACK_COLORS[i]} text-white rounded-2xl`}>
                      {t.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {step === "preview" && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-hot to-brand-mauve text-white font-bold py-4 rounded-2xl hover:shadow-[0_4px_24px_rgba(232,96,122,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 text-lg"
          >
            {loading ? "Đang xử lý..." : "LƯU VÀ TIẾP TỤC"}
          </button>
        )}

        {step === "upload" && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-brand-hot/40 text-brand-hot font-bold py-4 rounded-2xl hover:bg-brand-hot/10 hover:shadow-[0_4px_24px_rgba(232,96,122,0.15)] transition-all duration-300"
          >
            Chọn Ảnh Selfie
          </button>
        )}
      </div>
    </div>
  );
}
