import sharp from "sharp";
import path from "path";
import fs from "fs";
import { PrizeTier } from "@womanday/types";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const TEMPLATES_DIR = path.join(__dirname, "../../../public/templates");

// Tier badge color mapping — match web Light Pink v4 palette
const TIER_COLORS: Record<PrizeTier, string> = {
  FIRST: "#B8860B",   // dark goldenrod
  SECOND: "#6B6B78",  // cool slate
  THIRD: "#A0603C",   // sienna bronze
  CONS: "#B03060",    // deep magenta rose
};

// Lighter tint for badge background
const TIER_BG: Record<PrizeTier, string> = {
  FIRST: "rgba(184,134,11,0.15)",
  SECOND: "rgba(107,107,120,0.12)",
  THIRD: "rgba(160,96,60,0.15)",
  CONS: "rgba(176,48,96,0.12)",
};

const TIER_LABELS: Record<PrizeTier, string> = {
  FIRST: "GIẢI NHẤT",
  SECOND: "GIẢI NHÌ",
  THIRD: "GIẢI BA",
  CONS: "GIẢI KHUYẾN KHÍCH",
};

const TIER_VALUE_STR: Record<PrizeTier, string> = {
  FIRST: "2.500.000đ",
  SECOND: "1.000.000đ",
  THIRD: "500.000đ",
  CONS: "210.000đ",
};

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxCharsPerLine) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Gold gradient color stops per tier
const TIER_GRAD: Record<PrizeTier, [string, string, string]> = {
  FIRST: ["#D4AF37", "#FFD700", "#B8860B"],   // rich gold
  SECOND: ["#8B8B96", "#A8A8B4", "#6B6B78"],  // polished silver
  THIRD: ["#C07850", "#D4956B", "#A0603C"],    // warm bronze
  CONS: ["#D06888", "#E8849E", "#B03060"],     // rose shimmer
};

function buildSvgOverlay(
  name: string,
  dept: string,
  position: string,
  tier: PrizeTier
): Buffer {
  const color = TIER_COLORS[tier];
  const bgTint = TIER_BG[tier];
  const tierLabel = TIER_LABELS[tier];
  const valueStr = TIER_VALUE_STR[tier];
  const [gradStart, gradMid, gradEnd] = TIER_GRAD[tier];

  const nameLines = wrapText(name, 20);
  const nameStartY = 835;
  // Name — large bold with gradient
  const nameSvg = nameLines
    .map(
      (line, i) =>
        `<text x="540" y="${nameStartY + i * 62}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="56" font-weight="800" fill="url(#nameGrad)" text-anchor="middle" dominant-baseline="middle">${escSvg(line)}</text>`
    )
    .join("");

  // Name glow — stronger rose glow behind text
  const nameGlowSvg = nameLines
    .map(
      (line, i) =>
        `<text x="540" y="${nameStartY + i * 62}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="56" font-weight="800" fill="#E8607A" text-anchor="middle" dominant-baseline="middle" filter="url(#softGlow)" opacity="0.55">${escSvg(line)}</text>`
    )
    .join("");

  const nameBlockHeight = nameLines.length * 62;
  const deptY = nameStartY + nameBlockHeight + 14;
  const badgeY = deptY + 52;
  const valueY = badgeY + 140;

  // Badge — wider, taller, bolder
  const badgeSvg = `
    <rect x="230" y="${badgeY}" width="620" height="70" rx="35" fill="url(#badgeBg)" filter="url(#badgeShadow)"/>
    <rect x="230" y="${badgeY}" width="620" height="70" rx="35" fill="none" stroke="url(#tierGrad)" stroke-width="2.5"/>
    <text x="540" y="${badgeY + 42}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="30" font-weight="800" fill="url(#tierGrad)" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${escSvg(tierLabel)}</text>
  `;

  return Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Name gradient: deep rose, high contrast -->
      <linearGradient id="nameGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6B1830"/>
        <stop offset="50%" stop-color="#8B3A50"/>
        <stop offset="100%" stop-color="#5A1228"/>
      </linearGradient>

      <!-- Tier color gradient for badge text + border -->
      <linearGradient id="tierGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${gradStart}"/>
        <stop offset="50%" stop-color="${gradMid}"/>
        <stop offset="100%" stop-color="${gradEnd}"/>
      </linearGradient>

      <!-- Value text gradient: tier color shimmer (horizontal) -->
      <linearGradient id="valueGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${gradEnd}"/>
        <stop offset="35%" stop-color="${gradMid}"/>
        <stop offset="65%" stop-color="${gradStart}"/>
        <stop offset="100%" stop-color="${gradEnd}"/>
      </linearGradient>

      <!-- Badge background: cream + tier tint, more opaque -->
      <linearGradient id="badgeBg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FFF8F0"/>
        <stop offset="50%" stop-color="${bgTint}"/>
        <stop offset="100%" stop-color="#FFF8F0"/>
      </linearGradient>

      <!-- Gold line gradient — stronger -->
      <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(196,164,120,0)"/>
        <stop offset="15%" stop-color="rgba(196,164,120,0.55)"/>
        <stop offset="50%" stop-color="rgba(212,175,55,0.75)"/>
        <stop offset="85%" stop-color="rgba(196,164,120,0.55)"/>
        <stop offset="100%" stop-color="rgba(196,164,120,0)"/>
      </linearGradient>

      <!-- Panel border gradient — more visible -->
      <linearGradient id="panelBorder" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(196,164,120,0.55)"/>
        <stop offset="50%" stop-color="rgba(212,175,55,0.40)"/>
        <stop offset="100%" stop-color="rgba(196,164,120,0.55)"/>
      </linearGradient>

      <!-- Soft glow filter — bigger blur for name -->
      <filter id="softGlow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="8" result="blur"/>
      </filter>

      <!-- Badge drop shadow — stronger -->
      <filter id="badgeShadow" x="-5%" y="-15%" width="110%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${color}" flood-opacity="0.25"/>
      </filter>

      <!-- Value glow — bigger, brighter -->
      <filter id="valueGlow" x="-20%" y="-35%" width="140%" height="170%">
        <feGaussianBlur stdDeviation="10" result="blur"/>
      </filter>
    </defs>

    <!-- ── White frosted panel with gold border ── -->
    <rect x="50" y="775" width="980" height="535" rx="28" fill="rgba(255,255,255,0.94)"/>
    <rect x="50" y="775" width="980" height="535" rx="28" fill="none" stroke="url(#panelBorder)" stroke-width="3"/>
    <!-- Inner border -->
    <rect x="57" y="782" width="966" height="521" rx="24" fill="none" stroke="rgba(255,253,245,0.85)" stroke-width="1.5"/>

    <!-- ── Gold decorative lines — thicker ── -->
    <line x1="150" y1="805" x2="930" y2="805" stroke="url(#goldLine)" stroke-width="2"/>
    <line x1="200" y1="809" x2="880" y2="809" stroke="url(#goldLine)" stroke-width="0.8" opacity="0.6"/>

    <!-- ── Decorative sparkles ✦ — bigger ── -->
    <text x="140" y="808" font-size="16" fill="rgba(196,164,120,0.65)" text-anchor="middle">✦</text>
    <text x="940" y="808" font-size="16" fill="rgba(196,164,120,0.65)" text-anchor="middle">✦</text>
    <text x="540" y="808" font-size="14" fill="rgba(196,164,120,0.50)" text-anchor="middle">❖</text>

    <!-- ── Name glow layer ── -->
    ${nameGlowSvg}

    <!-- ── Name text ── -->
    ${nameSvg}

    <!-- ── Dept + Position — more visible ── -->
    <text x="540" y="${deptY}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="26" font-weight="500" fill="#B0506A" text-anchor="middle" dominant-baseline="middle" letter-spacing="1.5">${escSvg(dept)} · ${escSvg(position)}</text>

    <!-- ── Prize badge ── -->
    ${badgeSvg}

    <!-- ── Value glow — stronger ── -->
    <text x="540" y="${valueY}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="80" font-weight="900" fill="${color}" text-anchor="middle" dominant-baseline="middle" filter="url(#valueGlow)" opacity="0.50">${escSvg(valueStr)}</text>

    <!-- ── Value text with gradient — bigger ── -->
    <text x="540" y="${valueY}" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="80" font-weight="900" fill="url(#valueGrad)" text-anchor="middle" dominant-baseline="middle" letter-spacing="3">${escSvg(valueStr)}</text>

    <!-- ── Decorative bottom line ── -->
    <line x1="280" y1="${valueY + 52}" x2="800" y2="${valueY + 52}" stroke="url(#goldLine)" stroke-width="1.5"/>
    <text x="270" y="${valueY + 54}" font-size="10" fill="rgba(196,164,120,0.60)" text-anchor="middle">✦</text>
    <text x="810" y="${valueY + 54}" font-size="10" fill="rgba(196,164,120,0.60)" text-anchor="middle">✦</text>

    <!-- ── Date — clearer ── -->
    <text x="540" y="1272" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="24" font-weight="400" fill="#8B3A50" opacity="0.50" text-anchor="middle" dominant-baseline="middle" letter-spacing="3">Ngày 8 tháng 3 năm 2026</text>
    <text x="330" y="1274" font-size="16" fill="rgba(232,96,122,0.35)" text-anchor="middle">✿</text>
    <text x="750" y="1274" font-size="16" fill="rgba(232,96,122,0.35)" text-anchor="middle">✿</text>
  </svg>`);
}

// ── 100 lời chúc 8/3 ─────────────────────────────────────────────────────────
const GREETINGS: string[] = [
  "Chúc bạn luôn tươi trẻ, yêu đời và rạng ngời hạnh phúc.",
  "Người phụ nữ tuyệt vời nhất — chính là bạn!",
  "Chúc bạn mỗi ngày đều là một ngày đẹp nhất trong năm.",
  "Mạnh mẽ, dịu dàng và luôn tỏa sáng theo cách riêng của mình.",
  "Chúc bạn sức khỏe dồi dào, tâm hồn bình yên và nụ cười thường trực.",
  "Bạn là nguồn cảm hứng của tất cả mọi người xung quanh.",
  "Chúc bạn thành công vang dội và hạnh phúc ngập tràn.",
  "Một bông hoa đẹp nhất dành riêng cho bạn nhân ngày 8/3.",
  "Chúc mừng người phụ nữ đặc biệt — cảm ơn vì mọi điều bạn làm.",
  "Chúc bạn luôn là phiên bản tốt nhất của chính mình.",
  "Ngày hôm nay và mãi mãi — bạn xứng đáng được yêu thương.",
  "Chúc bạn bình an, vui vẻ và thật nhiều niềm vui bên gia đình.",
  "Tài năng của bạn là món quà quý giá cho cả tập thể.",
  "Chúc bạn luôn tràn đầy năng lượng và nhiệt huyết.",
  "Mỗi ngày bạn hiện diện là một ngày đồng nghiệp thêm vui.",
  "Chúc bạn gặt hái thật nhiều thành công trong năm mới.",
  "Bạn là người phụ nữ truyền cảm hứng cho tất cả chúng tôi.",
  "Chúc bạn luôn xinh đẹp, tự tin và rạng rỡ.",
  "Ngày Phụ Nữ nhắc chúng tôi biết ơn bạn mỗi ngày hơn.",
  "Chúc bạn có một năm thật trọn vẹn và ý nghĩa.",
  "Nụ cười của bạn là điều tươi sáng nhất nơi văn phòng này.",
  "Chúc bạn sức khỏe, may mắn và yêu thương ngập tràn.",
  "Bạn là sức mạnh thầm lặng của cả đội nhóm.",
  "Chúc bạn luôn hạnh phúc như bạn xứng đáng được hưởng.",
  "Cảm ơn bạn đã luôn cố gắng hết mình mỗi ngày.",
  "Chúc bạn thật nhiều niềm vui, ít lo âu và nhiều tiếng cười.",
  "Bạn xứng đáng được tôn vinh không chỉ một ngày trong năm.",
  "Chúc bạn những điều tốt đẹp nhất cuộc sống có thể trao.",
  "Bạn là bông hoa rực rỡ nhất trong khu vườn của chúng tôi.",
  "Chúc bạn mọi ước mơ đều thành hiện thực.",
  "Ngày 8/3 — ngày để cả thế giới tri ân người phụ nữ như bạn.",
  "Chúc bạn bước đi vững chắc trên con đường mình đã chọn.",
  "Bạn truyền năng lượng tích cực cho mọi người xung quanh.",
  "Chúc bạn yêu thương bản thân nhiều hơn mỗi ngày.",
  "Từng cống hiến của bạn đều được trân trọng sâu sắc.",
  "Chúc bạn một năm 2026 thật rực rỡ và đáng nhớ.",
  "Bạn chứng minh rằng phụ nữ có thể làm được mọi thứ.",
  "Chúc bạn niềm vui nho nhỏ mỗi buổi sáng thức dậy.",
  "Đằng sau thành công của công ty có bóng dáng tuyệt vời của bạn.",
  "Chúc bạn giỏi giang và đáng yêu mãi như thế này.",
  "Mùa xuân về — chúc bạn tươi tắn và rạng rỡ như hoa.",
  "Chúc bạn luôn được yêu thương và trân trọng.",
  "Người phụ nữ mạnh mẽ nhất không phải không bao giờ khóc, mà là tiếp tục dù khóc.",
  "Chúc bạn can đảm theo đuổi những điều mình yêu thích.",
  "Cảm ơn bạn vì sự tận tâm và nhiệt huyết không ngừng.",
  "Chúc bạn hôm nay thật đặc biệt vì bạn vốn đã đặc biệt.",
  "Bạn là lý do tại sao chúng tôi muốn đến văn phòng mỗi ngày.",
  "Chúc bạn thành công, bình an và luôn mỉm cười.",
  "Mọi thứ bạn chạm vào đều trở nên tốt đẹp hơn.",
  "Chúc bạn cuộc sống ngọt ngào như chính con người bạn.",
  "Sự xuất sắc của bạn truyền cảm hứng cho cả đội.",
  "Chúc bạn được nghỉ ngơi đủ và yêu thương thật nhiều.",
  "Bạn đã và đang tạo ra sự khác biệt tích cực mỗi ngày.",
  "Chúc bạn luôn tìm thấy niềm vui trong những điều nhỏ bé.",
  "Thật may mắn khi có bạn trong đội ngũ của chúng tôi.",
  "Chúc bạn một ngày 8/3 ngập tràn yêu thương và hoa tươi.",
  "Bạn là minh chứng sống cho sức mạnh và vẻ đẹp của phụ nữ.",
  "Chúc bạn sự nghiệp thăng hoa, gia đình hạnh phúc.",
  "Nụ cười bạn dành cho mọi người là món quà quý giá.",
  "Chúc bạn luôn có đủ sức mạnh để vượt qua mọi thử thách.",
  "Bạn không chỉ làm việc giỏi, bạn còn làm mọi người vui.",
  "Chúc bạn nhận được tình yêu thương bằng những gì bạn đã cho đi.",
  "Phụ nữ như bạn khiến thế giới này đẹp hơn rất nhiều.",
  "Chúc bạn luôn giữ được nụ cười rạng rỡ đó.",
  "Bạn là ánh sáng dẫn đường cho những người xung quanh.",
  "Chúc bạn dũng cảm, yêu đời và mãi thành công.",
  "Đóng góp của bạn không bao giờ bị quên lãng.",
  "Chúc bạn những điều bình dị nhưng hạnh phúc nhất.",
  "Bạn xứng đáng nhận được mọi điều tốt đẹp trên đời.",
  "Chúc bạn bầu trời xanh, nắng vàng và gió mát mỗi ngày.",
  "Tài năng + Nhiệt huyết + Bạn = Thành công không giới hạn.",
  "Chúc bạn luôn là phụ nữ của những điều phi thường.",
  "Mỗi ngày bạn truyền thêm động lực cho cả tập thể.",
  "Chúc bạn hạnh phúc giản dị nhưng thật trọn vẹn.",
  "Bạn chứng minh rằng dịu dàng không có nghĩa là yếu đuối.",
  "Chúc bạn luôn được bao quanh bởi những người yêu thương bạn.",
  "Cảm ơn bạn đã là chính mình — điều đó thật tuyệt vời.",
  "Chúc bạn ngày 8/3 rực rỡ như bông hoa mùa xuân.",
  "Bạn là người mà mọi người may mắn được quen biết.",
  "Chúc bạn thật nhiều khoảnh khắc vui vẻ và đáng nhớ.",
  "Nơi nào có bạn, nơi đó có năng lượng và niềm vui.",
  "Chúc bạn luôn tươi mới và tràn đầy hy vọng.",
  "Bạn đã làm mọi thứ trở nên tốt hơn bằng sự hiện diện của mình.",
  "Chúc bạn một năm bứt phá và thăng tiến vượt bậc.",
  "Phụ nữ như bạn xứng đáng được cả thế giới ngưỡng mộ.",
  "Chúc bạn những giấc mơ đẹp và đủ dũng cảm để theo đuổi.",
  "Sự chăm chỉ của bạn là nguồn cảm hứng cho cả đội.",
  "Chúc bạn mỗi bình minh là một trang mới đầy cơ hội.",
  "Bạn là lý do chúng tôi tin vào sức mạnh của đội nhóm.",
  "Chúc bạn sức khỏe là vàng, hạnh phúc là bạc và thành công là kim cương.",
  "Tất cả những gì bạn làm đều có ý nghĩa và giá trị.",
  "Chúc bạn ngày hôm nay đặc biệt như chính con người bạn.",
  "Bạn làm cho nơi làm việc trở thành nơi đáng đến hơn.",
  "Chúc bạn luôn có nụ cười làm vũ khí và tình yêu làm áo giáp.",
  "Mỗi thành tựu của công ty đều có dấu ấn của bạn trong đó.",
  "Chúc bạn được yêu thương trọn vẹn và hạnh phúc dài lâu.",
  "Bạn là minh chứng rằng phụ nữ Việt Nam thật tuyệt vời.",
  "Chúc bạn luôn khỏe mạnh, vui tươi và thật nhiều may mắn.",
  "Cảm ơn bạn — vì mọi điều bạn đang làm mỗi ngày.",
];

export const GREETINGS_FILE = path.join(UPLOAD_DIR, "greetings.json");

/** Đọc danh sách lời chúc: ưu tiên file JSON do admin lưu, fallback về mảng built-in */
export function getGreetingsList(): string[] {
  try {
    if (fs.existsSync(GREETINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(GREETINGS_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) return data as string[];
    }
  } catch {}
  return GREETINGS;
}

/** Lấy lời chúc deterministic dựa theo userId (không random mỗi lần) */
export function getGreeting(userId: string): string {
  const list = getGreetingsList();
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return list[hash % list.length];
}

function escSvg(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function circleMaskSvg(size: number): Buffer {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );
}

// Luxurious pink gradient background SVG with gold accents
function pinkGradientBgSvg(): Buffer {
  return Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Main background: warm pink gradient -->
      <linearGradient id="bg" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0%" stop-color="#FDE4EC"/>
        <stop offset="25%" stop-color="#F9C4D4"/>
        <stop offset="55%" stop-color="#F4A8C0"/>
        <stop offset="100%" stop-color="#EE90AE"/>
      </linearGradient>
      <!-- Center radial glow: soft white -->
      <radialGradient id="centerGlow" cx="50%" cy="35%" r="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45"/>
        <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
      <!-- Bottom warm glow -->
      <radialGradient id="bottomGlow" cx="50%" cy="90%" r="45%">
        <stop offset="0%" stop-color="#F9B4C8" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#F9B4C8" stop-opacity="0"/>
      </radialGradient>
      <!-- Gold corner gradient -->
      <linearGradient id="cornerGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(196,164,120,0.35)"/>
        <stop offset="100%" stop-color="rgba(196,164,120,0.08)"/>
      </linearGradient>
    </defs>

    <!-- Background layers -->
    <rect width="1080" height="1350" fill="url(#bg)"/>
    <rect width="1080" height="1350" fill="url(#centerGlow)"/>
    <rect width="1080" height="1350" fill="url(#bottomGlow)"/>

    <!-- ── Gold frame border (double line) ── -->
    <rect x="24" y="24" width="1032" height="1302" rx="20" fill="none" stroke="rgba(196,164,120,0.25)" stroke-width="1.5"/>
    <rect x="32" y="32" width="1016" height="1286" rx="16" fill="none" stroke="rgba(196,164,120,0.15)" stroke-width="1"/>

    <!-- ── Corner flourishes (curved lines) ── -->
    <!-- Top-left -->
    <path d="M40 90 C40 55, 55 40, 90 40" stroke="rgba(196,164,120,0.35)" stroke-width="1.5" fill="none"/>
    <path d="M40 110 C40 60, 60 40, 110 40" stroke="rgba(196,164,120,0.20)" stroke-width="1" fill="none"/>
    <circle cx="42" cy="88" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <circle cx="88" cy="42" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <!-- Top-right -->
    <path d="M1040 90 C1040 55, 1025 40, 990 40" stroke="rgba(196,164,120,0.35)" stroke-width="1.5" fill="none"/>
    <path d="M1040 110 C1040 60, 1020 40, 970 40" stroke="rgba(196,164,120,0.20)" stroke-width="1" fill="none"/>
    <circle cx="1038" cy="88" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <circle cx="992" cy="42" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <!-- Bottom-left -->
    <path d="M40 1260 C40 1295, 55 1310, 90 1310" stroke="rgba(196,164,120,0.35)" stroke-width="1.5" fill="none"/>
    <path d="M40 1240 C40 1290, 60 1310, 110 1310" stroke="rgba(196,164,120,0.20)" stroke-width="1" fill="none"/>
    <circle cx="42" cy="1262" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <circle cx="88" cy="1308" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <!-- Bottom-right -->
    <path d="M1040 1260 C1040 1295, 1025 1310, 990 1310" stroke="rgba(196,164,120,0.35)" stroke-width="1.5" fill="none"/>
    <path d="M1040 1240 C1040 1290, 1020 1310, 970 1310" stroke="rgba(196,164,120,0.20)" stroke-width="1" fill="none"/>
    <circle cx="1038" cy="1262" r="2.5" fill="rgba(196,164,120,0.40)"/>
    <circle cx="992" cy="1308" r="2.5" fill="rgba(196,164,120,0.40)"/>

    <!-- ── Header area defs ── -->
    <defs>
      <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#A04060"/>
        <stop offset="30%" stop-color="#8B3A50"/>
        <stop offset="70%" stop-color="#C06080"/>
        <stop offset="100%" stop-color="#A04060"/>
      </linearGradient>
      <linearGradient id="eightThreeGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E8607A"/>
        <stop offset="40%" stop-color="#D4708F"/>
        <stop offset="70%" stop-color="#C4977A"/>
        <stop offset="100%" stop-color="#E8607A"/>
      </linearGradient>
      <linearGradient id="headerLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(196,164,120,0)"/>
        <stop offset="25%" stop-color="rgba(196,164,120,0.50)"/>
        <stop offset="50%" stop-color="rgba(212,175,55,0.65)"/>
        <stop offset="75%" stop-color="rgba(196,164,120,0.50)"/>
        <stop offset="100%" stop-color="rgba(196,164,120,0)"/>
      </linearGradient>
      <filter id="headerGlow" x="-15%" y="-30%" width="130%" height="160%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
      </filter>
      <filter id="bigGlow" x="-20%" y="-25%" width="140%" height="150%">
        <feGaussianBlur stdDeviation="12" result="blur"/>
      </filter>
    </defs>

    <!-- ── Header decorative line top ── -->
    <line x1="250" y1="72" x2="830" y2="72" stroke="url(#headerLine)" stroke-width="1.2"/>
    <text x="240" y="74" font-size="10" fill="rgba(196,164,120,0.50)" text-anchor="middle">✦</text>
    <text x="840" y="74" font-size="10" fill="rgba(196,164,120,0.50)" text-anchor="middle">✦</text>

    <!-- ── "Chúc Mừng Ngày Phụ Nữ" — glow layer ── -->
    <text x="540" y="108" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="32" font-weight="600" fill="#E8607A" text-anchor="middle" filter="url(#headerGlow)" opacity="0.45">Chúc Mừng Ngày Phụ Nữ</text>

    <!-- ── "Chúc Mừng Ngày Phụ Nữ" — main text with gradient ── -->
    <text x="540" y="108" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="32" font-weight="600" fill="url(#headerGrad)" text-anchor="middle" letter-spacing="3" opacity="0.70">Chúc Mừng Ngày Phụ Nữ</text>

    <!-- ── Small ornament between header and 8/3 ── -->
    <text x="540" y="140" font-size="16" fill="rgba(196,164,120,0.45)" text-anchor="middle">❀</text>

    <!-- ── "8/3" — big glow layer ── -->
    <text x="540" y="215" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="100" font-weight="900" fill="#E8607A" text-anchor="middle" filter="url(#bigGlow)" opacity="0.18">8/3</text>

    <!-- ── "8/3" — main text with rose-gold gradient ── -->
    <text x="540" y="215" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="100" font-weight="900" fill="url(#eightThreeGrad)" text-anchor="middle" opacity="0.30">8/3</text>

    <!-- ── Header decorative line bottom ── -->
    <line x1="300" y1="248" x2="780" y2="248" stroke="url(#headerLine)" stroke-width="1"/>
    <text x="290" y="250" font-size="8" fill="rgba(196,164,120,0.45)" text-anchor="middle">✦</text>
    <text x="790" y="250" font-size="8" fill="rgba(196,164,120,0.45)" text-anchor="middle">✦</text>

    <!-- ── Sparkles scattered ── -->
    <text x="130" y="175" font-size="18" fill="rgba(196,164,120,0.30)">✦</text>
    <text x="930" y="155" font-size="16" fill="rgba(196,164,120,0.28)">✦</text>
    <text x="170" y="720" font-size="14" fill="rgba(196,164,120,0.22)">✧</text>
    <text x="910" y="740" font-size="14" fill="rgba(196,164,120,0.22)">✧</text>
    <text x="100" y="450" font-size="14" fill="rgba(232,96,122,0.15)">✿</text>
    <text x="980" y="500" font-size="14" fill="rgba(232,96,122,0.15)">✿</text>
  </svg>`);
}

export async function generateResultImage(params: {
  userId: string;
  name: string;
  dept: string;
  position: string;
  tier: PrizeTier;
  selfieLocalPath: string | null;
  templateId: number;
}): Promise<string> {
  const { userId, name, dept, position, tier, selfieLocalPath, templateId } = params;

  const resultsDir = path.join(UPLOAD_DIR, "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const outputPath = path.join(resultsDir, `${userId}.jpg`);

  // Template path (fallback to template 1 if not found)
  const tplId = templateId >= 1 && templateId <= 3 ? templateId : 1;
  const templatePath = path.join(TEMPLATES_DIR, `template_${tplId}.png`);

  let base: sharp.Sharp;

  // Always use pink gradient background (matches web Light Pink v4 theme)
  base = sharp(pinkGradientBgSvg()).resize(1080, 1350);

  const composites: sharp.OverlayOptions[] = [];

  // Selfie (circle crop, 420×420, centered, positioned higher)
  const selfieSize = 420;
  const selfieTop = 280;
  if (selfieLocalPath && fs.existsSync(selfieLocalPath)) {
    try {
      const selfieBuffer = await sharp(selfieLocalPath)
        .rotate()  // auto-rotate from EXIF
        .resize(selfieSize, selfieSize, { fit: "cover" })
        .composite([{ input: circleMaskSvg(selfieSize), blend: "dest-in" }])
        .png()
        .toBuffer();

      composites.push({
        input: selfieBuffer,
        left: (1080 - selfieSize) / 2,
        top: selfieTop,
      });

      // Double circle border: inner white + outer tier-colored
      const borderSize = selfieSize + 16;
      const borderSvg = Buffer.from(
        `<svg width="${borderSize}" height="${borderSize}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${borderSize / 2}" cy="${borderSize / 2}" r="${selfieSize / 2 + 5}" fill="none" stroke="white" stroke-width="4"/>
          <circle cx="${borderSize / 2}" cy="${borderSize / 2}" r="${selfieSize / 2 + 8}" fill="none" stroke="${TIER_COLORS[tier]}" stroke-width="2.5" opacity="0.7"/>
        </svg>`
      );
      composites.push({
        input: borderSvg,
        left: (1080 - borderSize) / 2,
        top: selfieTop - 8,
      });
    } catch {
      // ignore selfie errors
    }
  }

  // Text overlay SVG
  const textOverlay = buildSvgOverlay(name, dept, position, tier);
  composites.push({ input: textOverlay, top: 0, left: 0 });

  const result = await base.composite(composites).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(outputPath, result);

  return `/uploads/results/${userId}.jpg`;
}

export async function generateCardImage(params: {
  userId: string;
  name: string;
  dept: string;
  selfieLocalPath: string;
  templateId: number;
}): Promise<string> {
  const { userId, name, dept, selfieLocalPath, templateId } = params;

  const cardsDir = path.join(UPLOAD_DIR, "cards");
  fs.mkdirSync(cardsDir, { recursive: true });
  const outputPath = path.join(cardsDir, `${userId}.jpg`);

  const tplId = templateId >= 1 && templateId <= 3 ? templateId : 1;
  const adminTemplatePath = path.join(UPLOAD_DIR, "templates", `card_${tplId}.png`);
  const builtInTemplatePath = path.join(TEMPLATES_DIR, `card_${tplId}.png`);

  let base: sharp.Sharp;
  if (fs.existsSync(adminTemplatePath)) {
    base = sharp(adminTemplatePath).resize(1080, 1350);
  } else if (fs.existsSync(builtInTemplatePath)) {
    base = sharp(builtInTemplatePath).resize(1080, 1350);
  } else {
    base = sharp(pinkGradientBgSvg()).resize(1080, 1350);
  }

  const composites: sharp.OverlayOptions[] = [];

  if (fs.existsSync(selfieLocalPath)) {
    const selfieSize = 420;
    const selfieBuffer = await sharp(selfieLocalPath)
      .rotate()  // auto-rotate from EXIF
      .resize(selfieSize, selfieSize, { fit: "cover" })
      .composite([{ input: circleMaskSvg(selfieSize), blend: "dest-in" }])
      .png()
      .toBuffer();
    composites.push({ input: selfieBuffer, left: (1080 - selfieSize) / 2, top: 280 });

    // White border for card selfie
    const borderSize = selfieSize + 12;
    const borderSvg = Buffer.from(
      `<svg width="${borderSize}" height="${borderSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${borderSize / 2}" cy="${borderSize / 2}" r="${selfieSize / 2 + 4}" fill="none" stroke="white" stroke-width="4"/>
        <circle cx="${borderSize / 2}" cy="${borderSize / 2}" r="${selfieSize / 2 + 7}" fill="none" stroke="rgba(192,120,40,0.35)" stroke-width="2"/>
      </svg>`
    );
    composites.push({ input: borderSvg, left: (1080 - borderSize) / 2, top: 274 });
  }

  // Card text overlay — white frosted panel matching web theme
  const cardText = Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="760" width="1000" height="550" rx="32" fill="rgba(255,255,255,0.88)"/>
    <rect x="40" y="760" width="1000" height="550" rx="32" fill="none" stroke="rgba(196,164,120,0.30)" stroke-width="2"/>
    <text x="540" y="850" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="48" font-weight="700" fill="#8B3A50" text-anchor="middle">${escSvg(name)}</text>
    <text x="540" y="910" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="28" fill="#C06A82" text-anchor="middle">${escSvg(dept)}</text>
    <text x="540" y="1040" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="48" font-weight="800" fill="#E8607A" text-anchor="middle">Chúc Mừng 8/3</text>
    <text x="540" y="1100" font-size="56" text-anchor="middle">🌸</text>
    <text x="540" y="1270" font-family="'Be Vietnam Pro','Montserrat',Arial,sans-serif" font-size="24" fill="#8B3A50" opacity="0.45" text-anchor="middle">Ngày 8 tháng 3 năm 2026</text>
  </svg>`);
  composites.push({ input: cardText, top: 0, left: 0 });

  const result = await base.composite(composites).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(outputPath, result);

  return `/uploads/cards/${userId}.jpg`;
}
