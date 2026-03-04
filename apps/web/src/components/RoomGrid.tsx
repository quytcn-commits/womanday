"use client";

import { RoomParticipant, RoomStatus } from "@womanday/types";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from "@/lib/api";

interface Props {
  participants: RoomParticipant[];
  status: RoomStatus;
  revealedSlots?: Set<number>;
  results?: Record<number, { tier: string; value: number; label: string }>;
  compact?: boolean;
  mySlot?: number | null;
  flowerCounts?: Record<number, number>;
  onSendFlower?: (slotIndex: number) => void;
  canSendFlower?: boolean;
}

const TIER_BG: Record<string, string> = {
  FIRST:  "from-yellow-900/70 to-yellow-700/40",
  SECOND: "from-stone-700/70 to-stone-500/40",
  THIRD:  "from-orange-900/70 to-orange-700/40",
  CONS:   "from-rose-900/70 to-rose-700/40",
};

const TIER_EMOJI: Record<string, string> = {
  FIRST: "🌟", SECOND: "✨", THIRD: "🌸", CONS: "💐",
};

const TIER_LABEL: Record<string, string> = {
  FIRST: "Giải Nhất", SECOND: "Giải Nhì", THIRD: "Giải Ba", CONS: "Khuyến Khích",
};

// ══════════════════════════════════════════════════════════
// 12 Flower Themes — mỗi loài hoa đại diện 1 cá tính
// ══════════════════════════════════════════════════════════
interface FlowerTheme {
  emoji: string;
  name: string;
  trait: string;
  color: string;     // accent color cho khung
  variant: number;   // 0-3: kiểu khung góc
}

const FLOWER_THEMES: FlowerTheme[] = [
  { emoji: "🌹", name: "Hồng",        trait: "Quyến rũ",     color: "#C4586C", variant: 0 },
  { emoji: "🌸", name: "Anh Đào",     trait: "Dịu dàng",     color: "#D4889C", variant: 1 },
  { emoji: "🌷", name: "Tulip",       trait: "Thanh lịch",   color: "#9B5A72", variant: 2 },
  { emoji: "🌻", name: "Hướng Dương", trait: "Tươi sáng",    color: "#B89830", variant: 3 },
  { emoji: "🌺", name: "Dâm Bụt",    trait: "Nhiệt huyết",  color: "#D06050", variant: 0 },
  { emoji: "💐", name: "Oải Hương",   trait: "Bình yên",     color: "#8B70A0", variant: 1 },
  { emoji: "🌼", name: "Cúc",         trait: "Hồn nhiên",    color: "#C4A050", variant: 2 },
  { emoji: "🪷", name: "Sen",         trait: "Thuần khiết",  color: "#C87890", variant: 3 },
  { emoji: "🏵️", name: "Mẫu Đơn",   trait: "Sang trọng",   color: "#B06080", variant: 0 },
  { emoji: "🤍", name: "Bách Hợp",   trait: "Tinh khôi",    color: "#A09080", variant: 1 },
  { emoji: "🪻", name: "Lan",         trait: "Quý phái",     color: "#7868A0", variant: 2 },
  { emoji: "✿",  name: "Nhài",        trait: "Trong sáng",   color: "#68988B", variant: 3 },
];

function getTheme(slotIndex: number): FlowerTheme {
  return FLOWER_THEMES[slotIndex % 12];
}

// ══════════════════════════════════════════════════════════
// SVG Corner — 4 kiểu khung khác nhau
// ══════════════════════════════════════════════════════════

// Variant 0: Elegant Scroll — cổ điển, đường cong uyển chuyển + lá
function ScrollCorner({ color }: { color: string }) {
  return (
    <>
      <path d="M0 100 C0 55 18 25 50 3" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M0 100 C45 100 75 82 97 50" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M10 72 C13 52 22 38 40 24" stroke={color} strokeWidth="1" opacity="0.45" strokeLinecap="round" fill="none"/>
      <path d="M28 90 C42 88 58 78 70 62" stroke={color} strokeWidth="1" opacity="0.45" strokeLinecap="round" fill="none"/>
      <path d="M8 65 C14 57 12 48 8 52" stroke="#C4A478" strokeWidth="0.8" fill={color} fillOpacity={0.15}/>
      <path d="M50 92 C56 84 54 75 50 79" stroke="#C4A478" strokeWidth="0.8" fill={color} fillOpacity={0.15}/>
      <circle cx="50" cy="3" r="4" fill={color} opacity={0.55}/>
      <circle cx="97" cy="50" r="4" fill={color} opacity={0.55}/>
      <circle cx="30" cy="30" r="1.8" fill={color} opacity={0.3}/>
      <circle cx="60" cy="70" r="1.8" fill={color} opacity={0.3}/>
    </>
  );
}

// Variant 1: Petal — mềm mại, cánh hoa ở đầu đường cong
function PetalCorner({ color }: { color: string }) {
  return (
    <>
      <path d="M0 100 Q0 48 38 10" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M0 100 Q50 100 90 62" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <ellipse cx="15" cy="52" rx="6" ry="3" transform="rotate(-55 15 52)" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="0.5" opacity={0.4}/>
      <ellipse cx="50" cy="88" rx="6" ry="3" transform="rotate(-15 50 88)" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="0.5" opacity={0.4}/>
      <circle cx="38" cy="10" r="3.5" fill={color} opacity={0.5}/>
      <circle cx="34" cy="6" r="2.2" fill={color} opacity={0.25}/>
      <circle cx="42" cy="6" r="2.2" fill={color} opacity={0.25}/>
      <circle cx="38" cy="4" r="2" fill={color} opacity={0.2}/>
      <circle cx="90" cy="62" r="3.5" fill={color} opacity={0.5}/>
      <circle cx="93" cy="58" r="2.2" fill={color} opacity={0.25}/>
      <circle cx="93" cy="66" r="2.2" fill={color} opacity={0.25}/>
    </>
  );
}

// Variant 2: Art Deco — hình học, đường thẳng + kim cương
function DecoCorner({ color }: { color: string }) {
  return (
    <>
      <path d="M0 100 L0 48 Q2 18 32 5" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M0 100 L52 100 Q82 98 95 68" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M0 48 L4 44 L8 48 L4 52 Z" fill={color} opacity={0.35}/>
      <path d="M52 100 L56 96 L60 100 L56 104 Z" fill={color} opacity={0.35}/>
      <path d="M4 68 L4 52" stroke={color} strokeWidth="0.8" opacity={0.25} fill="none"/>
      <path d="M32 100 L52 97" stroke={color} strokeWidth="0.8" opacity={0.25} fill="none"/>
      <path d="M28 5 L32 0 L36 5 L32 10 Z" fill={color} opacity={0.5}/>
      <path d="M91 68 L95 63 L99 68 L95 73 Z" fill={color} opacity={0.5}/>
      <path d="M16 25 L18 23 L20 25 L18 27 Z" fill={color} opacity={0.2}/>
      <path d="M70 90 L72 88 L74 90 L72 92 Z" fill={color} opacity={0.2}/>
    </>
  );
}

// Variant 3: Vine — dây leo cuộn, chấm hoa nhỏ dọc đường
function VineCorner({ color }: { color: string }) {
  return (
    <>
      <path d="M0 100 C-5 58 12 28 45 8" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M0 100 C42 105 72 85 92 55" stroke="#C4A478" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M18 55 C22 48 20 42 16 46 C12 50 15 55 18 55Z" fill={color} fillOpacity={0.18} stroke={color} strokeWidth="0.5" opacity={0.4}/>
      <path d="M55 85 C60 80 58 74 54 77 C50 80 52 85 55 85Z" fill={color} fillOpacity={0.18} stroke={color} strokeWidth="0.5" opacity={0.4}/>
      <circle cx="8" cy="75" r="1.8" fill={color} opacity={0.3}/>
      <circle cx="25" cy="38" r="1.8" fill={color} opacity={0.3}/>
      <circle cx="35" cy="95" r="1.8" fill={color} opacity={0.3}/>
      <circle cx="65" cy="78" r="1.8" fill={color} opacity={0.3}/>
      <circle cx="45" cy="8" r="4" fill={color} opacity={0.55}/>
      <circle cx="92" cy="55" r="4" fill={color} opacity={0.55}/>
    </>
  );
}

const CORNER_VARIANTS = [ScrollCorner, PetalCorner, DecoCorner, VineCorner];

// ── Mini corner (compact cards ~20px) ────────────────────
function FlowerCornerMini({ position, color, variant }: {
  position: 'tl' | 'tr' | 'bl' | 'br'; color: string; variant: number;
}) {
  const posStyle: Record<string, React.CSSProperties> = {
    tl: { top: 2, left: 2, transform: 'scaleY(-1)' },
    tr: { top: 2, right: 2, transform: 'scale(-1,-1)' },
    bl: { bottom: 2, left: 2 },
    br: { bottom: 2, right: 2, transform: 'scaleX(-1)' },
  };
  const Variant = CORNER_VARIANTS[variant % 4];
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ width: 20, height: 20, zIndex: 4, ...posStyle[position] }}
      viewBox="0 0 100 100"
      fill="none"
    >
      <Variant color={color} />
    </svg>
  );
}

// ── Full corner (champion cards ~38px) ───────────────────
function FlowerCorner({ position, color, variant }: {
  position: 'tl' | 'tr' | 'bl' | 'br'; color: string; variant: number;
}) {
  const posStyle: Record<string, React.CSSProperties> = {
    tl: { top: 4, left: 4, transform: 'scaleY(-1)' },
    tr: { top: 4, right: 4, transform: 'scale(-1,-1)' },
    bl: { bottom: 4, left: 4 },
    br: { bottom: 4, right: 4, transform: 'scaleX(-1)' },
  };
  const Variant = CORNER_VARIANTS[variant % 4];
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ width: 38, height: 38, zIndex: 4, ...posStyle[position] }}
      viewBox="0 0 100 100"
      fill="none"
    >
      <Variant color={color} />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════
// Main Grid
// ══════════════════════════════════════════════════════════

export default function RoomGrid({ participants, status, revealedSlots, results, compact, mySlot, flowerCounts, onSendFlower, canSendFlower }: Props) {
  const isSpinning = status === "SPINNING" || status === "COUNTDOWN";

  // ── Compact mode (wall page) ─────────────────────────────
  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {participants.map((slot) => {
          const hasUser = slot.userId !== null;
          const isRevealed = revealedSlots?.has(slot.slotIndex);
          const result = results?.[slot.slotIndex];
          const theme = getTheme(slot.slotIndex);

          return (
            <motion.div
              key={slot.slotIndex}
              className={`slot-card ${hasUser ? "active" : ""}`}
              style={{ borderColor: theme.color }}
              animate={isSpinning && hasUser && !isRevealed
                ? { scale: [1, 1.03, 1], borderColor: [theme.color, "#E8607A", theme.color] }
                : {}}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              {/* Themed corners */}
              <FlowerCornerMini position="tl" color={theme.color} variant={theme.variant} />
              <FlowerCornerMini position="tr" color={theme.color} variant={theme.variant} />
              <FlowerCornerMini position="bl" color={theme.color} variant={theme.variant} />
              <FlowerCornerMini position="br" color={theme.color} variant={theme.variant} />

              {hasUser ? (
                slot.cardImageUrl ? (
                  /* Card image mode (compact) — show card thumbnail */
                  <div className="absolute inset-0 z-[1]">
                    <img
                      src={getApiUrl(slot.cardImageUrl)}
                      alt={slot.name || ""}
                      className="w-full h-full object-cover rounded-[14px]"
                    />
                    {isRevealed && result && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[14px]">
                        <span className="text-lg">{TIER_EMOJI[result.tier]}</span>
                      </div>
                    )}
                    {flowerCounts && flowerCounts[slot.slotIndex] > 0 && !isRevealed && (
                      <span className="absolute bottom-0.5 right-1 text-[7px] text-white font-semibold drop-shadow-md">🌸{flowerCounts[slot.slotIndex]}</span>
                    )}
                  </div>
                ) : (
                  /* Selfie mode (compact) — original display */
                  <div className="flex flex-col items-center p-1 w-full h-full relative z-[1]">
                    <div
                      className="w-9 h-9 rounded-full overflow-hidden mb-0.5 flex-shrink-0"
                      style={{ border: `1.5px solid ${theme.color}40` }}
                    >
                      {slot.selfieUrl ? (
                        <img src={getApiUrl(slot.selfieUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#FFF3E4] flex items-center justify-center text-sm">{theme.emoji}</div>
                      )}
                    </div>
                    <p className="text-[8px] text-brand-deep font-semibold text-center truncate w-full">
                      {slot.name?.split(" ").slice(-1)[0]}
                    </p>
                    <span className="text-[8px] leading-none">{theme.emoji}</span>
                    {isRevealed && result && (
                      <span className="text-[9px]">{TIER_EMOJI[result.tier]}</span>
                    )}
                    {flowerCounts && flowerCounts[slot.slotIndex] > 0 && !isRevealed && (
                      <span className="text-[7px] text-brand-gold font-semibold">🌸 {flowerCounts[slot.slotIndex]}</span>
                    )}
                  </div>
                )
              ) : (
                /* Empty slot — flower identity */
                <div className="flex flex-col items-center justify-center w-full h-full relative z-[1] gap-0.5">
                  <motion.span
                    className="text-xl leading-none"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.70, 0.35] }}
                    transition={{ repeat: Infinity, duration: 3, delay: slot.slotIndex * 0.15 }}
                  >
                    {theme.emoji}
                  </motion.span>
                  <p className="text-[7px] font-semibold leading-none" style={{ color: theme.color, opacity: 0.7 }}>
                    {theme.name}
                  </p>
                  <p className="text-[6px] font-light leading-none" style={{ color: theme.color, opacity: 0.45 }}>
                    {theme.trait}
                  </p>
                </div>
              )}

              {/* Slot number */}
              <span className="absolute top-0.5 left-1 text-[6px] z-[2]" style={{ color: `${theme.color}50` }}>
                {slot.slotIndex}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // ── Full mode (join page) — champion-select style ────
  const team1 = participants.slice(0, 6);
  const team2 = participants.slice(6, 12);

  return (
    <div className="w-full h-full select-none flex flex-col justify-center gap-2">
      {/* Team 1 — top 6 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
        {team1.map((slot) => (
          <ChampionCard
            key={slot.slotIndex}
            slot={slot}
            isSpinning={isSpinning}
            isRevealed={revealedSlots?.has(slot.slotIndex) ?? false}
            result={results?.[slot.slotIndex]}
            isMe={mySlot === slot.slotIndex}
            flowerCount={flowerCounts?.[slot.slotIndex] || 0}
            onSendFlower={onSendFlower}
            canSendFlower={canSendFlower}
          />
        ))}
      </div>

      {/* Floral divider — 8/3 */}
      <div className="flex items-center gap-3 my-0.5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C4A478]/30 to-transparent" />
        <motion.div
          className="flex items-center gap-2"
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <span className="text-base md:text-lg">🌸</span>
          <span className="text-[#C4A478]/70 font-bold text-[10px] md:text-xs tracking-[0.35em]">8 · 3</span>
          <span className="text-base md:text-lg">🌸</span>
        </motion.div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#C4A478]/30 to-transparent" />
      </div>

      {/* Team 2 — bottom 6 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
        {team2.map((slot) => (
          <ChampionCard
            key={slot.slotIndex}
            slot={slot}
            isSpinning={isSpinning}
            isRevealed={revealedSlots?.has(slot.slotIndex) ?? false}
            result={results?.[slot.slotIndex]}
            isMe={mySlot === slot.slotIndex}
            flowerCount={flowerCounts?.[slot.slotIndex] || 0}
            onSendFlower={onSendFlower}
            canSendFlower={canSendFlower}
          />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Champion Card — full mode with flower theme
// Supports 3 display modes:
//   1. Card image (cardImageUrl) → full tarot card display
//   2. Selfie only → selfie + corners + name bar
//   3. Empty → flower identity placeholder
// ══════════════════════════════════════════════════════════

function ChampionCard({
  slot, isSpinning, isRevealed, result, isMe,
  flowerCount = 0, onSendFlower, canSendFlower,
}: {
  slot: RoomParticipant;
  isSpinning: boolean;
  isRevealed: boolean;
  result?: { tier: string; value: number; label: string };
  isMe: boolean;
  flowerCount?: number;
  onSendFlower?: (slotIndex: number) => void;
  canSendFlower?: boolean;
}) {
  const hasUser = slot.userId !== null;
  const hasCard = hasUser && !!slot.cardImageUrl;
  const tierBg = isRevealed && result ? TIER_BG[result.tier] : "";
  const theme = getTheme(slot.slotIndex);
  const canTapFlower = hasUser && canSendFlower && onSendFlower && !isRevealed;

  // ── MODE 1: Card Image — full tarot-style card display ────
  if (hasCard) {
    return (
      <motion.div
        className={`champion-card active aspect-[3/4] ${canTapFlower ? "cursor-pointer" : ""}`}
        style={{ borderColor: "#C4A478", background: "#1E1230" }}
        animate={isSpinning && !isRevealed ? {
          boxShadow: [
            "0 4px 20px rgba(196,164,120,0.20), 0 0 0 rgba(232,96,122,0)",
            "0 4px 32px rgba(196,164,120,0.45), 0 0 20px rgba(232,96,122,0.12)",
            "0 4px 20px rgba(196,164,120,0.20), 0 0 0 rgba(232,96,122,0)",
          ],
        } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
        onClick={canTapFlower ? () => onSendFlower(slot.slotIndex) : undefined}
        whileTap={canTapFlower ? { scale: 0.95 } : undefined}
      >
        {/* Card image — fills slot, preserving card's own ornate border */}
        <img
          src={getApiUrl(slot.cardImageUrl!)}
          alt={slot.name || ""}
          className="absolute inset-[2px] w-[calc(100%-4px)] h-[calc(100%-4px)] object-cover rounded-[16px]"
        />

        {/* Spinning shimmer */}
        <AnimatePresence>
          {isSpinning && !isRevealed && (
            <motion.div
              className="absolute inset-[2px] rounded-[16px] z-[2]"
              animate={{ opacity: [0, 0.2, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ background: "linear-gradient(180deg, rgba(196,164,120,0.08) 0%, rgba(232,96,122,0.12) 100%)" }}
            />
          )}
        </AnimatePresence>

        {/* Prize reveal overlay */}
        <AnimatePresence>
          {isRevealed && result && (
            <motion.div
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute inset-[2px] rounded-[16px] flex flex-col items-center justify-center bg-gradient-to-b ${tierBg} backdrop-blur-sm z-[3]`}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl mb-1"
              >
                {TIER_EMOJI[result.tier]}
              </motion.span>
              <p className="text-white font-black text-xs text-center px-1 leading-tight">
                {TIER_LABEL[result.tier]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flower count badge */}
        {flowerCount > 0 && !isRevealed && (
          <motion.div
            key={flowerCount}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="absolute bottom-[8px] right-[8px] z-[5]"
          >
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[9px] font-bold shadow-md"
              style={{ background: "linear-gradient(135deg, #C4977A, #E8749A)" }}
            >
              🌸 <span>×{flowerCount}</span>
            </div>
          </motion.div>
        )}

        {/* ME badge */}
        {isMe && !isRevealed && (
          <div className="absolute top-2 right-2 z-[6]">
            <span
              className="text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-md"
              style={{ backgroundColor: theme.color }}
            >
              Bạn
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  // ── MODE 2 & 3: Selfie or Empty — original behavior with theme corners ────
  return (
    <motion.div
      className={`champion-card ${hasUser ? "active" : ""} aspect-[3/4] ${canTapFlower ? "cursor-pointer" : ""}`}
      style={{ borderColor: theme.color }}
      animate={
        isSpinning && hasUser && !isRevealed
          ? { borderColor: [theme.color, "#E8607A", theme.color] }
          : {}
      }
      transition={{ repeat: Infinity, duration: 0.9 }}
      onClick={canTapFlower ? () => onSendFlower(slot.slotIndex) : undefined}
      whileTap={canTapFlower ? { scale: 0.95 } : undefined}
    >
      {/* Themed corner ornaments */}
      <FlowerCorner position="tl" color={theme.color} variant={theme.variant} />
      <FlowerCorner position="tr" color={theme.color} variant={theme.variant} />
      <FlowerCorner position="bl" color={theme.color} variant={theme.variant} />
      <FlowerCorner position="br" color={theme.color} variant={theme.variant} />

      {hasUser ? (
        <>
          {/* Selfie photo */}
          <div className="absolute inset-[6px] rounded-xl overflow-hidden z-[1]">
            {slot.selfieUrl ? (
              <img
                src={getApiUrl(slot.selfieUrl)}
                alt={slot.name || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-[#FFF3E4] to-[#FFFDF5] flex items-center justify-center">
                <span className="text-4xl opacity-40">{theme.emoji}</span>
              </div>
            )}
          </div>

          {/* Spinning pulse overlay */}
          <AnimatePresence>
            {isSpinning && !isRevealed && (
              <motion.div
                className="absolute inset-[6px] rounded-xl z-[2]"
                style={{ backgroundColor: `${theme.color}08` }}
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
              />
            )}
          </AnimatePresence>

          {/* Prize reveal overlay */}
          <AnimatePresence>
            {isRevealed && result && (
              <motion.div
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute inset-[6px] rounded-xl flex flex-col items-center justify-center bg-gradient-to-b ${tierBg} backdrop-blur-sm z-[3]`}
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-4xl mb-1"
                >
                  {TIER_EMOJI[result.tier]}
                </motion.span>
                <p className="text-white font-black text-xs text-center px-1 leading-tight">
                  {TIER_LABEL[result.tier]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flower badge — top center */}
          {!isRevealed && (
            <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-[5]">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm"
                style={{ backgroundColor: `${theme.color}20`, border: `1px solid ${theme.color}35` }}
              >
                {theme.emoji}
              </div>
            </div>
          )}

          {/* Bottom name bar */}
          {!isRevealed && (
            <div className="absolute bottom-[6px] left-[6px] right-[6px] rounded-b-xl bg-gradient-to-t from-brand-deep/80 via-brand-deep/40 to-transparent pt-6 pb-1.5 px-1.5 z-[2]">
              <p className="text-white font-bold text-[10px] sm:text-xs truncate leading-tight">
                {slot.name?.split(" ").slice(-2).join(" ")}
              </p>
              <p className="text-white/50 text-[7px] sm:text-[8px] truncate font-light">
                {slot.dept} · <span style={{ color: `${theme.color}CC` }}>{theme.trait}</span>
              </p>
            </div>
          )}

          {/* Flower count badge */}
          {flowerCount > 0 && !isRevealed && (
            <motion.div
              key={flowerCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="absolute bottom-[52px] right-[8px] z-[5]"
            >
              <div
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[9px] font-bold shadow-md"
                style={{ background: "linear-gradient(135deg, #C4977A, #E8749A)" }}
              >
                🌸 <span>×{flowerCount}</span>
              </div>
            </motion.div>
          )}

          {/* "ME" badge */}
          {isMe && !isRevealed && (
            <div className="absolute top-2 right-2 z-[6]">
              <span
                className="text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-md"
                style={{ backgroundColor: theme.color }}
              >
                Bạn
              </span>
            </div>
          )}

          {/* Slot number */}
          <span className="absolute top-2 left-2 text-[8px] text-white/40 font-light z-[2]">
            {slot.slotIndex}
          </span>
        </>
      ) : (
        /* Empty slot — flower identity with celestial accents */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Subtle celestial sparkle */}
          <motion.div
            className="absolute top-3 right-4 text-[8px] opacity-0"
            animate={{ opacity: [0, 0.4, 0], scale: [0.8, 1.1, 0.8] }}
            transition={{ repeat: Infinity, duration: 4, delay: slot.slotIndex * 0.3 }}
          >
            &#x2726;
          </motion.div>
          <motion.div
            className="absolute bottom-4 left-3 text-[7px] opacity-0"
            style={{ color: theme.color }}
            animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.1, 0.8] }}
            transition={{ repeat: Infinity, duration: 5, delay: 1 + slot.slotIndex * 0.2 }}
          >
            &#x2727;
          </motion.div>

          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.30, 0.65, 0.30] }}
            transition={{ repeat: Infinity, duration: 3, delay: slot.slotIndex * 0.18 }}
            className="text-3xl mb-1"
          >
            {theme.emoji}
          </motion.div>
          <p className="text-[10px] font-semibold" style={{ color: theme.color, opacity: 0.7 }}>
            {theme.name}
          </p>
          <p className="text-[8px] font-light italic" style={{ color: theme.color, opacity: 0.45 }}>
            {theme.trait}
          </p>
          <span className="text-[8px] font-light tracking-widest mt-1" style={{ color: `${theme.color}40` }}>
            #{slot.slotIndex}
          </span>
        </div>
      )}
    </motion.div>
  );
}
