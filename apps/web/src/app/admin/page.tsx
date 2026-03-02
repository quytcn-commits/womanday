"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiUpload, getApiUrl } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

interface RoomRow { id: string; name: string | null; status: string; participantCount: number; waitingSecondsElapsed: number | null; }
interface Stats {
  totalParticipants: number; spunCount: number; remainingCount: number; eventStatus: string;
  eventRound: number;
  prizePool: Record<string, { total: number; assigned: number; remaining: number; label?: string; color?: string }>;
}
interface PrizeTierConfig {
  tier: string; label: string; value: number; count: number; color: string;
}
interface HistoryRound {
  round: number; isCurrent: boolean; totalSpun: number;
  startedAt: string | null; endedAt: string | null;
  prizeBreakdown: { tier: string; count: number; totalValue: number }[];
}

type Tab = "event" | "prizes" | "templates" | "data";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "event", label: "Điều hành", icon: "🎯" },
  { key: "prizes", label: "Giải thưởng", icon: "🎁" },
  { key: "templates", label: "Thiệp & Lời chúc", icon: "🎨" },
  { key: "data", label: "Dữ liệu", icon: "📊" },
];

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("event");

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [templateSlots, setTemplateSlots] = useState<{ id: number; hasTemplate: boolean; previewUrl: string | null }[]>([
    { id: 1, hasTemplate: false, previewUrl: null },
    { id: 2, hasTemplate: false, previewUrl: null },
    { id: 3, hasTemplate: false, previewUrl: null },
  ]);
  const [templateUploading, setTemplateUploading] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [greetingsText, setGreetingsText] = useState("");
  const [greetingsSaving, setGreetingsSaving] = useState(false);
  const [greetingsLoaded, setGreetingsLoaded] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [prizeConfig, setPrizeConfig] = useState<PrizeTierConfig[]>([]);
  const [prizeConfigLoaded, setPrizeConfigLoaded] = useState(false);
  const [prizeSaving, setPrizeSaving] = useState(false);
  const [eventName, setEventName] = useState("WomanDay Spin 8/3");
  const [eventNameSaving, setEventNameSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    if (u.role !== "admin") { router.push("/ready"); return; }
    loadData();
    apiFetch<{ eventName: string; eventStatus: string }>("/api/v1/event/info")
      .then((res) => { if (res.eventName) setEventName(res.eventName); })
      .catch(() => {});
    apiFetch<{ greetings: string[] }>("/api/v1/admin/greetings")
      .then(({ greetings }) => { setGreetingsText(greetings.join("\n")); setGreetingsLoaded(true); })
      .catch(() => setGreetingsLoaded(true));
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load prize config when switching to prizes tab
  useEffect(() => {
    if (activeTab === "prizes" && !prizeConfigLoaded) loadPrizeConfig();
    if (activeTab === "data" && !historyLoaded) loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadData() {
    try {
      const [roomsRes, statsRes, tplRes] = await Promise.all([
        apiFetch<{ rooms: RoomRow[] }>("/api/v1/admin/rooms"),
        apiFetch<Stats>("/api/v1/admin/stats"),
        apiFetch<{ slots: { id: number; hasTemplate: boolean; previewUrl: string | null }[] }>("/api/v1/admin/templates/card"),
      ]);
      setRooms(roomsRes.rooms);
      setStats(statsRes);
      setTemplateSlots(tplRes.slots);
    } catch {}
  }

  async function createRoom() {
    const name = prompt("Tên phòng (VD: Chi nhánh HN, hoặc bỏ trống):");
    setLoading(true);
    try {
      const res = await apiFetch<{ room: { id: string } }>("/api/v1/admin/rooms", {
        method: "POST",
        body: JSON.stringify({ name: name || undefined }),
      });
      setMsg(`Đã tạo phòng ${res.room.id}${name ? ` — ${name}` : ""}`);
      await loadData();
    } catch (e: any) { setMsg("Lỗi: " + (e.message || "Lỗi")) }
    finally { setLoading(false); }
  }

  async function renameRoom(roomId: string, currentName: string | null) {
    const name = prompt("Đổi tên phòng:", currentName || "");
    if (name === null) return;
    try {
      await apiFetch(`/api/v1/admin/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      setMsg(`Đã đổi tên phòng ${roomId}`);
      await loadData();
    } catch (e: any) { setMsg("Lỗi: " + (e.message || "Lỗi")); }
  }

  async function removeRoom(roomId: string) {
    if (!confirm(`Xóa phòng ${roomId}? Không thể hoàn tác.`)) return;
    try {
      await apiFetch(`/api/v1/admin/rooms/${roomId}`, { method: "DELETE" });
      setMsg(`Đã xóa phòng ${roomId}`);
      await loadData();
    } catch (e: any) { setMsg("Lỗi: " + (e.message || "Lỗi")); }
  }

  async function startNow(roomId: string) {
    try {
      await apiFetch(`/api/v1/admin/rooms/${roomId}/start-now`, { method: "POST" });
      setMsg(`Phòng ${roomId} đang đếm ngược...`);
      await loadData();
    } catch (e: any) { setMsg("Lỗi: " + (e.message || "Lỗi")) }
  }

  async function setEventStatus(action: "start" | "stop") {
    try {
      await apiFetch(`/api/v1/admin/event/${action}`, { method: "POST" });
      setMsg(action === "start" ? "Sự kiện đã bắt đầu" : "Sự kiện đã dừng");
      await loadData();
    } catch {}
  }

  async function exportCSV(round?: number) {
    const url = round ? `/api/v1/admin/export/results?round=${round}` : "/api/v1/admin/export/results";
    window.open(getApiUrl(url), "_blank");
  }

  async function handleTemplateUpload(slotId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setMsg(`Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 15MB`);
      e.target.value = "";
      return;
    }
    setMsg(`Đang upload mẫu #${slotId} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
    setTemplateUploading(slotId);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("template_id", String(slotId));
    try {
      const res = await apiUpload<{ success: boolean; templateId: number; previewUrl: string; message: string }>("/api/v1/admin/templates/card", fd);
      setTemplateSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, hasTemplate: true, previewUrl: res.previewUrl + "?t=" + Date.now() } : s));
      setMsg(res.message);
    } catch (err: any) {
      setMsg(`Upload mẫu #${slotId} lỗi: ${err.message || "Lỗi không xác định"}`);
    }
    finally { setTemplateUploading(null); e.target.value = ""; }
  }

  async function regenerateCards() {
    setRegenerating(true);
    try {
      const res = await apiFetch<{ success: boolean; total: number; message: string }>("/api/v1/admin/templates/regenerate", { method: "POST" });
      setMsg(res.message);
    } catch (e: any) { setMsg("Lỗi: " + e.message); }
    finally { setRegenerating(false); }
  }

  async function saveGreetings() {
    const list = greetingsText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) { setMsg("Danh sách lời chúc không được rỗng"); return; }
    setGreetingsSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; count: number; message: string }>("/api/v1/admin/greetings", {
        method: "PUT",
        body: JSON.stringify({ greetings: list }),
      });
      setMsg(res.message);
    } catch (e: any) { setMsg("Lỗi: " + e.message); }
    finally { setGreetingsSaving(false); }
  }

  async function resetEvent() {
    if (resetConfirm < 2) {
      setResetConfirm((c) => c + 1);
      return;
    }
    setResetting(true);
    try {
      const res = await apiFetch<{ success: boolean; newRound: number; message: string }>("/api/v1/admin/event/reset", { method: "POST" });
      setMsg(res.message);
      setResetConfirm(0);
      setPrizeConfigLoaded(false);
      setHistoryLoaded(false);
      await loadData();
    } catch (e: any) { setMsg("Reset lỗi: " + (e.message || "Lỗi")); }
    finally { setResetting(false); }
  }

  async function saveEventName() {
    setEventNameSaving(true);
    try {
      await apiFetch("/api/v1/admin/event/name", {
        method: "PUT",
        body: JSON.stringify({ name: eventName }),
      });
      setMsg("Đã cập nhật tên sự kiện");
    } catch (e: any) { setMsg("Lỗi: " + (e.message || "Lỗi")); }
    finally { setEventNameSaving(false); }
  }

  async function loadHistory() {
    try {
      const res = await apiFetch<{ currentRound: number; rounds: HistoryRound[] }>("/api/v1/admin/event/history");
      setHistory(res.rounds);
      setHistoryLoaded(true);
    } catch (e: any) { setMsg("Lỗi tải lịch sử: " + e.message); }
  }

  async function loadPrizeConfig() {
    try {
      const res = await apiFetch<{ tiers: PrizeTierConfig[] }>("/api/v1/admin/prize-config");
      setPrizeConfig(res.tiers);
      setPrizeConfigLoaded(true);
    } catch (e: any) { setMsg("Lỗi tải cấu hình: " + e.message); }
  }

  async function savePrizeConfig() {
    if (prizeConfig.length === 0) { setMsg("Cần ít nhất 1 hạng giải"); return; }
    setPrizeSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/v1/admin/prize-config", {
        method: "PUT", body: JSON.stringify({ tiers: prizeConfig }),
      });
      setMsg(res.message);
    } catch (e: any) { setMsg("Lỗi: " + e.message); }
    finally { setPrizeSaving(false); }
  }

  function updatePrizeTier(idx: number, field: keyof PrizeTierConfig, val: string | number) {
    setPrizeConfig((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  function addPrizeTier() {
    setPrizeConfig((prev) => [...prev, { tier: `TIER${prev.length + 1}`, label: "Giải mới", value: 0, count: 1, color: "#D4708F" }]);
  }

  function removePrizeTier(idx: number) {
    setPrizeConfig((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await apiUpload<{ imported: number; skipped: number; errors: string[] }>("/api/v1/auth/import-csv", fd);
      setMsg(`Import: ${res.imported} nhân viên. Bỏ qua: ${res.skipped}`);
    } catch (e: any) { setMsg("Import lỗi: " + e.message) }
    e.target.value = "";
  }

  if (!mounted) return null;

  const prizeTotal = prizeConfig.reduce((s, t) => s + t.count, 0);
  const prizeTotalValue = prizeConfig.reduce((s, t) => s + t.value * t.count, 0);

  return (
    <div className="min-h-screen bg-brand-pink text-brand-deep">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-white/40 backdrop-blur-sm border-b border-brand-hot/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-brand-deep">Admin Panel</h1>
              {stats && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    stats.eventStatus === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {stats.eventStatus}
                  </span>
                  <span className="text-brand-deep/40 text-xs">Round #{stats.eventRound}</span>
                  <span className="text-brand-deep/30 text-xs">|</span>
                  <span className="text-brand-hot text-xs font-semibold">{stats.spunCount}/{stats.totalParticipants} quay</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a href="/wall" target="_blank" className="text-brand-hot text-xs font-semibold hover:text-brand-mauve transition-colors px-2 py-1">
                Wall
              </a>
              <button onClick={() => router.push("/")} className="text-brand-deep/40 text-xs hover:text-brand-deep transition-colors px-2 py-1">
                Logout
              </button>
            </div>
          </div>

          {/* ── Tab Navigation ───────────────────────────────── */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.key
                    ? "border-brand-hot text-brand-hot"
                    : "border-transparent text-brand-deep/40 hover:text-brand-deep/70 hover:border-brand-deep/10"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toast Message ──────────────────────────────────── */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-6xl mx-auto px-4 mt-3"
          >
            <div
              className="glass p-3 text-sm text-brand-deep/80 cursor-pointer flex items-center justify-between"
              onClick={() => setMsg("")}
            >
              <span>{msg}</span>
              <span className="text-brand-deep/30 text-xs ml-2">click to dismiss</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab Content ────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === "event" && <TabEvent
          stats={stats} rooms={rooms} loading={loading}
          resetConfirm={resetConfirm} resetting={resetting}
          eventName={eventName} eventNameSaving={eventNameSaving}
          onEventNameChange={setEventName} onSaveEventName={saveEventName}
          onCreateRoom={createRoom} onStartNow={startNow}
          onRenameRoom={renameRoom} onRemoveRoom={removeRoom}
          onEventStatus={setEventStatus} onReset={resetEvent}
          onResetBlur={() => setResetConfirm(0)}
        />}
        {activeTab === "prizes" && <TabPrizes
          stats={stats} prizeConfig={prizeConfig} prizeConfigLoaded={prizeConfigLoaded}
          prizeSaving={prizeSaving} prizeTotal={prizeTotal} prizeTotalValue={prizeTotalValue}
          onSave={savePrizeConfig} onUpdate={updatePrizeTier}
          onAdd={addPrizeTier} onRemove={removePrizeTier}
        />}
        {activeTab === "templates" && <TabTemplates
          templateSlots={templateSlots} templateUploading={templateUploading}
          regenerating={regenerating} greetingsText={greetingsText}
          greetingsSaving={greetingsSaving} greetingsLoaded={greetingsLoaded}
          onTemplateUpload={handleTemplateUpload} onRegenerate={regenerateCards}
          onGreetingsChange={setGreetingsText} onSaveGreetings={saveGreetings}
          getApiUrl={getApiUrl}
        />}
        {activeTab === "data" && <TabData
          history={history} historyLoaded={historyLoaded}
          onExportCSV={exportCSV} onImportCsv={handleImportCsv}
        />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Điều hành
   ════════════════════════════════════════════════════════════ */

function TabEvent({ stats, rooms, loading, resetConfirm, resetting, eventName, eventNameSaving, onEventNameChange, onSaveEventName, onCreateRoom, onStartNow, onRenameRoom, onRemoveRoom, onEventStatus, onReset, onResetBlur }: {
  stats: Stats | null; rooms: RoomRow[]; loading: boolean;
  resetConfirm: number; resetting: boolean;
  eventName: string; eventNameSaving: boolean;
  onEventNameChange: (v: string) => void; onSaveEventName: () => void;
  onCreateRoom: () => void; onStartNow: (id: string) => void;
  onRenameRoom: (id: string, name: string | null) => void; onRemoveRoom: (id: string) => void;
  onEventStatus: (a: "start" | "stop") => void; onReset: () => void; onResetBlur: () => void;
}) {
  const eventUrl = typeof window !== "undefined" ? `${window.location.origin}/event` : "/event";

  return (
    <div className="space-y-4">
      {/* Event Config + QR */}
      <div className="glass p-4">
        <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Sự Kiện Self-Service</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-brand-deep/50 text-xs font-medium mb-1 block">Tên sự kiện</label>
              <div className="flex gap-2">
                <input
                  value={eventName}
                  onChange={(e) => onEventNameChange(e.target.value)}
                  placeholder="VD: WomanDay Spin 8/3"
                  className="flex-1 bg-white/60 border border-brand-hot/12 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-hot/40"
                />
                <button
                  onClick={onSaveEventName}
                  disabled={eventNameSaving}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {eventNameSaving ? "..." : "Lưu"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-brand-deep/50 text-xs font-medium mb-1 block">Link tham gia</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white/60 border border-brand-hot/12 rounded-lg px-3 py-2 text-xs text-brand-deep/70 truncate">{eventUrl}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(eventUrl)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand-hot/15 text-brand-hot hover:bg-brand-hot/25 transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-brand-deep/30 text-[10px]">
              Nhân viên scan QR hoặc truy cập link, bấm &quot;Tham gia&quot; sẽ tự động vào phòng quay. Quay xong tự chuyển thành khán giả.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <QRCodeSVG value={eventUrl} size={140} level="M" />
            </div>
            <span className="text-brand-deep/40 text-[10px]">QR tham gia sự kiện</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-4">
        <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Hành Động Nhanh</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ActionButton
            onClick={() => onEventStatus("start")}
            color="green"
            label="Start Event"
            sub={stats?.eventStatus === "ACTIVE" ? "Đang hoạt động" : "Bắt đầu sự kiện"}
          />
          <ActionButton
            onClick={() => onEventStatus("stop")}
            color="amber"
            label="Stop Event"
            sub="Tạm dừng sự kiện"
          />
          <ActionButton
            onClick={onCreateRoom}
            disabled={loading}
            color="rose"
            label="+ Tạo Phòng"
            sub={`${rooms.length} phòng hiện tại`}
          />
          <ActionButton
            onClick={onReset}
            onBlur={onResetBlur}
            disabled={resetting}
            color="red"
            label={resetting ? "Resetting..." : resetConfirm === 0 ? "Reset Event" : resetConfirm === 1 ? "Chắc chắn?" : "XÁC NHẬN!"}
            sub="Chuyển sang round mới"
            pulse={resetConfirm > 0}
          />
        </div>
      </div>

      {/* Rooms Table */}
      <div className="glass p-4">
        <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">
          Phòng Hiện Tại ({rooms.length})
        </p>
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🏠</p>
            <p className="text-brand-deep/40 text-sm">Chưa có phòng nào</p>
            <p className="text-brand-deep/25 text-xs mt-1">Nhấn &quot;+ Tạo Phòng&quot; để bắt đầu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-deep/40 text-[10px] uppercase tracking-wider">
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">Tên phòng</th>
                  <th className="text-left py-2 px-2">Trạng thái</th>
                  <th className="text-center py-2 px-2">Người</th>
                  <th className="text-center py-2 px-2">Timer</th>
                  <th className="text-right py-2 px-2">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-brand-hot/8">
                    <td className="py-2.5 px-2 font-mono font-semibold text-brand-deep">{room.id}</td>
                    <td className="py-2.5 px-2 text-brand-deep/70 text-xs max-w-[140px] truncate">
                      {room.name || <span className="text-brand-deep/25 italic">—</span>}
                    </td>
                    <td className="py-2.5 px-2"><StatusChip status={room.status} /></td>
                    <td className="py-2.5 px-2 text-center text-brand-deep/70">{room.participantCount}/12</td>
                    <td className="py-2.5 px-2 text-center text-brand-deep/40 text-xs">
                      {room.waitingSecondsElapsed != null ? `${room.waitingSecondsElapsed}s` : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onRenameRoom(room.id, room.name)}
                          className="text-brand-deep/40 text-xs hover:text-brand-deep transition-colors"
                          title="Đổi tên"
                        >
                          ✏️
                        </button>
                        {["CREATED", "DONE"].includes(room.status) && (
                          <button
                            onClick={() => onRemoveRoom(room.id)}
                            className="text-red-300 text-xs hover:text-red-500 transition-colors"
                            title="Xóa phòng"
                          >
                            🗑️
                          </button>
                        )}
                        <a
                          href={`/wall?room=${room.id}`}
                          target="_blank"
                          className="text-brand-hot text-xs font-semibold hover:text-brand-mauve transition-colors"
                        >
                          Wall
                        </a>
                        {room.status === "WAITING" && (
                          <button
                            onClick={() => onStartNow(room.id)}
                            className="bg-brand-hot text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-brand-mauve transition-colors"
                          >
                            START NOW
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Giải thưởng
   ════════════════════════════════════════════════════════════ */

function TabPrizes({ stats, prizeConfig, prizeConfigLoaded, prizeSaving, prizeTotal, prizeTotalValue, onSave, onUpdate, onAdd, onRemove }: {
  stats: Stats | null; prizeConfig: PrizeTierConfig[]; prizeConfigLoaded: boolean;
  prizeSaving: boolean; prizeTotal: number; prizeTotalValue: number;
  onSave: () => void; onUpdate: (idx: number, field: keyof PrizeTierConfig, val: string | number) => void;
  onAdd: () => void; onRemove: (idx: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Prize Pool — live status */}
      {stats && (
        <div className="glass p-4">
          <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Prize Pool — Trạng Thái Hiện Tại</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(stats.prizePool).map(([tier, p]) => {
              const pct = p.total > 0 ? (p.assigned / p.total) * 100 : 0;
              return (
                <div key={tier} className="rounded-xl p-3" style={{ background: `${p.color || "#D4708F"}08`, border: `1px solid ${p.color || "#D4708F"}18` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold" style={{ color: p.color || "#D4708F" }}>{p.label || tier}</span>
                    <span className="text-brand-deep/40 text-[10px]">{p.assigned}/{p.total}</span>
                  </div>
                  <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: p.color || "#D4708F" }} />
                  </div>
                  <p className="text-brand-deep/30 text-[10px] mt-1">Còn {p.remaining} giải</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prize Config — editable */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest">Cấu Hình Giải Thưởng</p>
            <p className="text-brand-deep/35 text-xs mt-1">
              Tổng: <span className="font-semibold text-brand-deep/60">{prizeTotal} giải</span>
              {prizeTotalValue > 0 && <> | <span className="font-semibold text-brand-deep/60">{(prizeTotalValue / 1000000).toFixed(1)}M VNĐ</span></>}
            </p>
          </div>
          <button
            onClick={onSave}
            disabled={prizeSaving || !prizeConfigLoaded}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {prizeSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>

        {!prizeConfigLoaded ? (
          <div className="text-center py-6 text-brand-deep/30 text-sm">Đang tải...</div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[2.5rem_5rem_1fr_7rem_4rem_2rem] gap-2 px-1 mb-2">
              <span className="text-brand-deep/30 text-[10px] uppercase">Màu</span>
              <span className="text-brand-deep/30 text-[10px] uppercase">Tier ID</span>
              <span className="text-brand-deep/30 text-[10px] uppercase">Tên giải</span>
              <span className="text-brand-deep/30 text-[10px] uppercase text-right">Giá trị (VNĐ)</span>
              <span className="text-brand-deep/30 text-[10px] uppercase text-center">SL</span>
              <span></span>
            </div>
            <div className="space-y-2">
              {prizeConfig.map((t, idx) => (
                <div key={idx} className="grid grid-cols-[2.5rem_5rem_1fr_7rem_4rem_2rem] gap-2 items-center">
                  <input
                    type="color" value={t.color}
                    onChange={(e) => onUpdate(idx, "color", e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-brand-hot/10 p-0.5"
                  />
                  <input
                    value={t.tier}
                    onChange={(e) => onUpdate(idx, "tier", e.target.value)}
                    placeholder="TIER_ID"
                    className="bg-white/60 border border-brand-hot/12 rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:border-brand-hot/40"
                  />
                  <input
                    value={t.label}
                    onChange={(e) => onUpdate(idx, "label", e.target.value)}
                    placeholder="Mô tả giải (VD: Giải Nhất — 2.500.000đ)"
                    className="bg-white/60 border border-brand-hot/12 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-brand-hot/40"
                  />
                  <input
                    type="number" value={t.value}
                    onChange={(e) => onUpdate(idx, "value", parseInt(e.target.value) || 0)}
                    placeholder="0 = quà"
                    className="bg-white/60 border border-brand-hot/12 rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:border-brand-hot/40"
                  />
                  <input
                    type="number" value={t.count} min={1}
                    onChange={(e) => onUpdate(idx, "count", Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-white/60 border border-brand-hot/12 rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:border-brand-hot/40"
                  />
                  <button
                    onClick={() => onRemove(idx)}
                    className="text-red-300 hover:text-red-500 transition-colors text-sm leading-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={onAdd}
              className="mt-3 text-brand-hot text-xs font-semibold hover:text-brand-mauve transition-colors"
            >
              + Thêm hạng giải
            </button>
          </>
        )}

        <p className="text-brand-deep/25 text-[10px] mt-3 border-t border-brand-hot/8 pt-2">
          Cấu hình sẽ được áp dụng khi Reset Event (tạo round mới). Giá trị = 0 cho quà vật phẩm (không phải tiền).
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Thiệp & Lời chúc
   ════════════════════════════════════════════════════════════ */

function TabTemplates({ templateSlots, templateUploading, regenerating, greetingsText, greetingsSaving, greetingsLoaded, onTemplateUpload, onRegenerate, onGreetingsChange, onSaveGreetings, getApiUrl }: {
  templateSlots: { id: number; hasTemplate: boolean; previewUrl: string | null }[];
  templateUploading: number | null; regenerating: boolean;
  greetingsText: string; greetingsSaving: boolean; greetingsLoaded: boolean;
  onTemplateUpload: (id: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRegenerate: () => void; onGreetingsChange: (v: string) => void; onSaveGreetings: () => void;
  getApiUrl: (p: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Card Templates */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest">Mẫu Thiệp Nền</p>
            <p className="text-brand-deep/35 text-xs mt-0.5">3 mẫu — Tỉ lệ 4:5 (1080x1350px)</p>
          </div>
          <button
            onClick={onRegenerate}
            disabled={regenerating || templateSlots.every((s) => !s.hasTemplate)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-30 transition-colors"
          >
            {regenerating ? "Đang tái tạo..." : "Tái tạo tất cả thiệp"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {templateSlots.map((slot) => (
            <div key={slot.id} className="flex flex-col items-center gap-2">
              {slot.hasTemplate && slot.previewUrl ? (
                <img
                  src={getApiUrl(slot.previewUrl!)}
                  alt={`Mẫu ${slot.id}`}
                  className="w-full aspect-[3/4] object-cover rounded-lg border border-brand-hot/20"
                />
              ) : (
                <div className="w-full aspect-[3/4] rounded-lg border border-dashed border-brand-deep/15 flex flex-col items-center justify-center bg-white/40 gap-1">
                  <span className="text-2xl">🎨</span>
                  <span className="text-brand-deep/30 text-xs">Chưa có</span>
                </div>
              )}
              <label className={`w-full text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                templateUploading === slot.id ? "bg-white/50 text-brand-deep/30" : "bg-brand-hot/15 text-brand-hot hover:bg-brand-hot/25"
              }`}>
                {templateUploading === slot.id ? "..." : `Upload mẫu #${slot.id}`}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onTemplateUpload(slot.id, e)}
                  disabled={templateUploading !== null}
                />
              </label>
            </div>
          ))}
        </div>
        <p className="text-brand-deep/25 text-[10px] mt-3">Nhân viên chọn 1 trong 3 mẫu khi chụp selfie. Nhấn &quot;Tái tạo&quot; để áp mẫu mới cho tất cả thiệp đã tạo.</p>
      </div>

      {/* Greetings */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest">Lời Chúc 8/3</p>
            <p className="text-brand-deep/35 text-xs mt-0.5">
              {greetingsText ? `${greetingsText.split("\n").filter(s => s.trim()).length} lời chúc` : "Đang tải..."}
              {" — "}Mỗi dòng 1 lời chúc, chọn ngẫu nhiên cho mỗi NV
            </p>
          </div>
          <button
            onClick={onSaveGreetings}
            disabled={greetingsSaving || !greetingsLoaded}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {greetingsSaving ? "Đang lưu..." : "Lưu lời chúc"}
          </button>
        </div>
        <textarea
          value={greetingsText}
          onChange={(e) => onGreetingsChange(e.target.value)}
          rows={10}
          placeholder={"Mỗi dòng 1 lời chúc\nVí dụ:\nChúc bạn luôn tươi trẻ, yêu đời và rạng ngời hạnh phúc.\nNgười phụ nữ tuyệt vời nhất — chính là bạn!"}
          className="w-full bg-white/60 border border-brand-hot/12 rounded-xl px-3 py-2.5 text-brand-deep text-sm leading-relaxed resize-y focus:outline-none focus:border-brand-hot/40 placeholder-brand-deep/25"
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: Dữ liệu
   ════════════════════════════════════════════════════════════ */

function TabData({ history, historyLoaded, onExportCSV, onImportCsv }: {
  history: HistoryRound[]; historyLoaded: boolean;
  onExportCSV: (round?: number) => void;
  onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Import / Export */}
      <div className="glass p-4">
        <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Import / Export</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onExportCSV()}
            className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/50 border border-brand-hot/10 hover:border-brand-hot/25 hover:bg-white/70 transition-all"
          >
            <span className="text-2xl">📥</span>
            <span className="text-xs font-semibold text-brand-deep/70">Export CSV</span>
            <span className="text-[10px] text-brand-deep/30">Kết quả round hiện tại</span>
          </button>
          <label className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/50 border border-brand-hot/10 hover:border-brand-hot/25 hover:bg-white/70 transition-all cursor-pointer">
            <span className="text-2xl">📤</span>
            <span className="text-xs font-semibold text-brand-deep/70">Import CSV</span>
            <span className="text-[10px] text-brand-deep/30">Thêm nhân viên</span>
            <input type="file" accept=".csv" className="hidden" onChange={onImportCsv} />
          </label>
          <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/30 border border-brand-deep/5">
            <span className="text-2xl">📋</span>
            <span className="text-xs font-semibold text-brand-deep/40">Format CSV</span>
            <code className="text-[10px] text-brand-deep/35 text-center leading-relaxed">
              cccd,dob,name,position,dept
            </code>
          </div>
        </div>
      </div>

      {/* Event History */}
      <div className="glass p-4">
        <p className="text-brand-deep/50 text-[10px] font-semibold uppercase tracking-widest mb-3">Lịch Sử Sự Kiện</p>
        {!historyLoaded ? (
          <div className="text-center py-6 text-brand-deep/30 text-sm">Đang tải...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-brand-deep/30 text-sm">Chưa có lịch sử</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-deep/40 text-[10px] uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Round</th>
                  <th className="text-center py-2 px-2">Đã quay</th>
                  <th className="text-left py-2 px-2">Giải thưởng</th>
                  <th className="text-left py-2 px-2">Ngày</th>
                  <th className="text-right py-2 px-2">Export</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.round} className={`border-t border-brand-hot/8 ${r.isCurrent ? "bg-brand-hot/[0.03]" : ""}`}>
                    <td className="py-2.5 px-2 font-semibold">
                      #{r.round}
                      {r.isCurrent && <span className="text-brand-hot text-[10px] ml-1">(hiện tại)</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">{r.totalSpun}</td>
                    <td className="py-2.5 px-2 text-xs text-brand-deep/50">
                      {r.prizeBreakdown.map((p) => `${p.tier}: ${p.count}`).join(", ") || "—"}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-brand-deep/40">
                      {r.startedAt ? new Date(r.startedAt).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {r.totalSpun > 0 && (
                        <button
                          onClick={() => onExportCSV(r.round)}
                          className="text-brand-hot text-xs font-semibold hover:text-brand-mauve transition-colors"
                        >
                          CSV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Shared components
   ════════════════════════════════════════════════════════════ */

function ActionButton({ onClick, onBlur, disabled, color, label, sub, pulse }: {
  onClick: () => void; onBlur?: () => void; disabled?: boolean;
  color: "green" | "amber" | "rose" | "red"; label: string; sub: string; pulse?: boolean;
}) {
  const colorMap = {
    green: "bg-green-600 hover:bg-green-700 text-white",
    amber: "bg-amber-500 hover:bg-amber-600 text-white",
    rose: "bg-brand-hot hover:bg-brand-mauve text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button
      onClick={onClick}
      onBlur={onBlur}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all disabled:opacity-40 ${colorMap[color]} ${pulse ? "animate-pulse" : ""}`}
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="text-[10px] opacity-70">{sub}</span>
    </button>
  );
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, string> = {
    CREATED: "bg-gray-100 text-gray-600",
    WAITING: "bg-blue-100 text-blue-700",
    LOCKED: "bg-red-100 text-red-700",
    COUNTDOWN: "bg-orange-100 text-orange-700",
    SPINNING: "bg-yellow-100 text-yellow-700",
    REVEAL: "bg-purple-100 text-purple-700",
    DONE: "bg-green-100 text-green-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config[status] || config.CREATED}`}>
      {status}
    </span>
  );
}
