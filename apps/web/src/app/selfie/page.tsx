"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiUpload, apiFetch, getApiUrl } from "@/lib/api";
import { getUser, updateUser } from "@/lib/auth";

const FALLBACK_COLORS = ["from-brand-hot/50 to-brand-rose/30", "from-brand-rose/50 to-brand-gold/30", "from-brand-mauve/50 to-brand-hot/30"];

interface TemplateOption { id: number; name: string; previewUrl: string | null; }

/** Try client-side preview using createImageBitmap (handles JPEG/PNG/WebP, may fail for HEIC) */
async function tryClientPreview(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const MAX = 640;
    let w = bitmap.width, h = bitmap.height;
    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
    else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

export default function SelfiePage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(1);
  const [templates, setTemplates] = useState<TemplateOption[]>([
    { id: 1, name: "Hoa Anh Đào", previewUrl: null },
    { id: 2, name: "Hoa Hồng Vàng", previewUrl: null },
    { id: 3, name: "Tím Thanh Lịch", previewUrl: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "preview">("upload");
  // Track if selfie was already uploaded to server (for HEIC fallback)
  const [selfieOnServer, setSelfieOnServer] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) { router.push("/login"); return; }
    apiFetch<{ templates: TemplateOption[] }>("/api/v1/selfie/templates", { auth: false })
      .then(({ templates: tpls }) => setTemplates(tpls))
      .catch(() => {});
  }, [router]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // On some Android devices, camera files have empty MIME type
    if (file.type && !file.type.startsWith("image/")) { setError("Vui lòng chọn file ảnh"); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Ảnh quá lớn (tối đa 15MB)"); return; }
    setSelectedFile(file);
    setSelfieOnServer(false);
    setError("");

    // Strategy 1: Client-side preview (instant, works for JPEG/PNG/WebP)
    try {
      const preview = await tryClientPreview(file);
      setPreviewUrl(preview);
      setStep("preview");
      return;
    } catch {
      // HEIC or unsupported format — fall through to server preview
    }

    // Strategy 2: Upload to server for conversion (HEIC → JPEG via sharp)
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload<{ success: boolean; selfieUrl: string }>(
        "/api/v1/selfie/upload-preview",
        formData
      );
      // Use server-converted JPEG as preview
      setPreviewUrl(getApiUrl(res.selfieUrl) + "?t=" + Date.now());
      setSelfieOnServer(true);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Không thể tải ảnh lên, vui lòng thử lại");
    } finally {
      setUploading(false);
    }
  };

  async function handleSubmit() {
    if (!selectedFile && !selfieOnServer) { setError("Vui lòng chọn ảnh selfie"); return; }
    setLoading(true);
    setError("");
    try {
      let res: { success: boolean; selfieUrl: string; cardImageUrl: string | null; greeting: string | null };

      if (selfieOnServer) {
        // Selfie already on server (HEIC was uploaded via preview) — just generate card
        res = await apiFetch<typeof res>("/api/v1/selfie/generate-card", {
          method: "POST",
          body: JSON.stringify({ template_id: templateId }),
        });
      } else {
        // Normal flow: upload selfie + generate card in one step
        const formData = new FormData();
        formData.append("file", selectedFile!);
        formData.append("template_id", String(templateId));
        res = await apiUpload<typeof res>("/api/v1/selfie/upload", formData);
      }

      updateUser({ selfieUrl: res.selfieUrl, cardImageUrl: res.cardImageUrl, cardTemplateId: templateId, greeting: res.greeting ?? null });
      router.push("/ready");
    } catch (err: any) {
      const msg = err.code === 413 ? "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn" :
        err.message || "Upload thất bại, vui lòng thử lại";
      setError(msg);
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

        <label
          htmlFor="selfie-input"
          className="glass p-6 mb-4 cursor-pointer hover:border-brand-hot/30 hover:shadow-[0_4px_30px_rgba(232,96,122,0.12)] transition-all duration-300 block"
        >
          {uploading ? (
            <div className="aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl">
              <div className="w-10 h-10 border-3 border-brand-hot/30 border-t-brand-hot rounded-full animate-spin" />
              <p className="text-sm font-light text-brand-deep/50">Đang xử lý ảnh...</p>
            </div>
          ) : previewUrl ? (
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
              <p className="text-xs text-brand-rose/30 font-light">Hỗ trợ tất cả định dạng ảnh</p>
            </div>
          )}
        </label>
        <input
          id="selfie-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="sr-only"
        />

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
            {loading ? "Đang tạo thiệp..." : "LƯU VÀ TIẾP TỤC"}
          </button>
        )}

        {step === "upload" && !uploading && (
          <label
            htmlFor="selfie-input"
            className="w-full border border-brand-hot/40 text-brand-hot font-bold py-4 rounded-2xl hover:bg-brand-hot/10 hover:shadow-[0_4px_24px_rgba(232,96,122,0.15)] transition-all duration-300 block text-center cursor-pointer"
          >
            Chọn Ảnh Selfie
          </label>
        )}
      </div>
    </div>
  );
}
