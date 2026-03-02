# PRD — Women's Day Live Spin 8/3
## Hệ thống Quay Thưởng Nội Bộ Sự Kiện 8/3

**Phiên bản:** 1.0
**Ngày:** 2026-02-28
**Ngôn ngữ:** Tiếng Việt

---

# MỤC LỤC

1. PRD Tóm Tắt
2. Wireframe Mô Tả Từng Màn Hình
3. State Machine + Sequence Diagram
4. API Spec
5. Realtime Event Spec
6. Database Schema (SQL DDL)
7. Pseudocode Các Luồng Chính
8. Checklist Vận Hành Sự Kiện (Runbook)
9. Test Plan
10. Design Assets Checklist

---

# 1. PRD TÓM TẮT

## 1.1 Tổng Quan

| Mục | Nội dung |
|-----|----------|
| Tên sản phẩm | WomanDay Spin — Mini Game Quay Thưởng 8/3 |
| Loại | Web App nội bộ (internal) |
| Đối tượng | 400 nhân viên nữ toàn hệ thống |
| Ngân sách tổng | 100.000.000 VND |
| Ngày sự kiện | 8/3 (năm hiện tại) |
| Platform | Web (mobile-first), hiển thị trên màn hình lớn /wall |

## 1.2 Mục Tiêu Sản Phẩm

- Tạo trải nghiệm quay thưởng trực tuyến kịch tính, vui vẻ cho toàn nhân viên nữ.
- Mỗi nhân viên nữ chắc chắn nhận quà (100% có thưởng).
- Tạo nội dung viral: ảnh thiệp cá nhân hóa để share Facebook.
- Livestream toàn công ty xem được quá trình quay thưởng.
- Hệ thống chat realtime kết nối nhân viên các văn phòng.

## 1.3 Cấu Trúc Giải Thưởng

| Giải | Số lượng | Giá trị | Tổng |
|------|----------|---------|------|
| Nhất | 1 | 2.500.000 VND | 2.500.000 |
| Nhì | 10 | 1.000.000 VND | 10.000.000 |
| Ba | 20 | 500.000 VND | 10.000.000 |
| Khuyến khích | 369 | 210.000 VND | 77.490.000 |
| **TỔNG** | **400** | — | **99.990.000 VND** |

> **Ghi chú:** Tổng 99.990.000 VND ≈ 100.000.000 VND (dư 10.000 VND dự phòng chi phí vận hành).

## 1.4 Cấu Trúc Phòng

- Mỗi phòng: tối đa 12 người.
- Tổng số phòng tối thiểu: ⌈400/12⌉ = 34 phòng (thực tế admin tạo theo nhu cầu).
- Phòng có N người (N ≤ 12) thì quay N người cùng lúc.
- Admin chủ động tạo phòng và quản lý tiến trình.

## 1.5 Luồng Chính

```
Nhân viên Login → Upload Selfie → Tạo Thiệp → Scan QR Join Room
→ [Room WAITING] → [Room LOCKED] → [COUNTDOWN 30s] → [AUTO SPIN]
→ [REVEAL kết quả] → Nhận ảnh cá nhân hóa → Share Facebook
```

## 1.6 Công Nghệ Đề Xuất

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + Framer Motion |
| Backend | Node.js / Fastify hoặc NestJS |
| Database | PostgreSQL (Supabase hoặc self-hosted) |
| Realtime | Socket.IO (hoặc Supabase Realtime) |
| Image Gen | Node + sharp + canvas (server-side) |
| CDN/Storage | Cloudflare R2 hoặc AWS S3 |
| Cache | Redis (rate limit, room state) |
| Auth | JWT + OTP đơn giản (nội bộ) |

## 1.7 Giả Định

- Hệ thống nội bộ, triển khai trên server công ty (không public internet).
- HR cung cấp file CSV danh sách nhân viên nữ (mã NV, tên, phòng ban).
- Có màn hình LED/TV để chiếu trang /wall.
- Admin có laptop riêng để điều hành dashboard.
- OTP gửi qua email/Slack nội bộ hoặc dùng token đơn giản (demo).

---

# 2. WIREFRAME MÔ TẢ TỪNG MÀN HÌNH

## 2.1 Màn Hình Login (/login)

```
┌─────────────────────────────────────────────┐
│          🌸 WOMEN'S DAY 8/3 2026 🌸          │
│                                              │
│         ┌──────────────────────┐             │
│  Logo   │   Mã Nhân Viên       │             │
│         └──────────────────────┘             │
│         ┌──────────────────────┐             │
│         │   OTP / Token         │             │
│         └──────────────────────┘             │
│                                              │
│         [ ĐĂNG NHẬP ]                        │
│                                              │
│  (c) Công ty — Sự kiện nội bộ               │
└─────────────────────────────────────────────┘
```

**Elements:**
- Logo công ty + decoration 8/3
- Input: Mã nhân viên (employee_code)
- Input: OTP 6 số (gửi qua email/Slack) hoặc token tĩnh (demo)
- Button: ĐĂNG NHẬP
- Error state: "Mã nhân viên không đúng", "OTP sai/hết hạn"
- Success: redirect → /selfie

---

## 2.2 Màn Hình Selfie & Tạo Thiệp (/selfie)

```
┌─────────────────────────────────────────────┐
│  ← Bước 1/2: Chụp ảnh & Tạo Thiệp          │
│                                              │
│  [Camera/Upload area — 1:1 square preview]  │
│  ┌─────────────────────────┐                │
│  │     📷 Preview          │                │
│  │     [Crop Square]       │                │
│  └─────────────────────────┘                │
│                                              │
│  [ 📷 Chụp ảnh ]  [ 📁 Upload ]             │
│                                              │
│  ─── Chọn template thiệp ───                 │
│  ┌───┐ ┌───┐ ┌───┐                          │
│  │T1 │ │T2 │ │T3 │  (có tick chọn)           │
│  └───┘ └───┘ └───┘                          │
│                                              │
│  Preview thiệp đã ghép:                      │
│  ┌─────────────────────────┐                │
│  │  [Template + Selfie]   │                 │
│  │  Tên: Nguyễn Thị A     │                 │
│  │  Phòng: Kế Toán         │                │
│  └─────────────────────────┘                │
│                                              │
│         [ LƯU VÀ TIẾP TỤC → ]               │
└─────────────────────────────────────────────┘
```

**Elements:**
- Camera access (getUserMedia) hoặc file upload
- Crop tool: crop vuông 1:1
- Compress: tối đa 3MB sau compress
- 3 template thiệp 8/3 để chọn
- Preview realtime ghép selfie + template
- Button: Lưu → gọi API upload + generate card image
- Sau lưu: redirect → /ready

---

## 2.3 Màn Hình Ready / Chờ Join (/ready)

```
┌─────────────────────────────────────────────┐
│  ✅ Thiệp của bạn đã sẵn sàng!               │
│                                              │
│  [Preview thiệp nhỏ]                         │
│  Xin chào, Nguyễn Thị A 🌸                  │
│                                              │
│  ─── Cách tham gia ───                       │
│  1. Nhìn lên màn hình livestream             │
│  2. Scan QR code hiển thị trên màn hình      │
│  3. Hoặc bấm nút bên dưới khi có link        │
│                                              │
│  [ SCAN QR JOIN ROOM ]                       │
│                                              │
│  💬 Chat cộng đồng đang diễn ra →            │
│  [Chat preview nhỏ]                          │
└─────────────────────────────────────────────┘
```

---

## 2.4 Màn Hình Join Room (/join?room=ROOM_ID)

```
┌─────────────────────────────────────────────┐
│  🎰 Phòng Quay #R001                         │
│                                              │
│  [Grid 12 slot — avatar + tên]              │
│  ┌────┐┌────┐┌────┐┌────┐                   │
│  │ A  ││ B  ││ C  ││    │  Slot 1-4         │
│  └────┘└────┘└────┘└────┘                   │
│  ┌────┐┌────┐┌────┐┌────┐                   │
│  │    ││    ││    ││    │  Slot 5-8  (empty) │
│  └────┘└────┘└────┘└────┘                   │
│  ┌────┐┌────┐┌────┐┌────┐                   │
│  │    ││    ││    ││    │  Slot 9-12 (empty) │
│  └────┘└────┘└────┘└────┘                   │
│                                              │
│  Trạng thái: ⏳ WAITING (3/12)               │
│  Timer: Còn 00:27 giây đến auto start        │
│                                              │
│  Vị trí của bạn: Slot 2 ✅                   │
└─────────────────────────────────────────────┘
```

**States hiển thị:**
- WAITING: grid slots, timer, số người
- LOCKED: "Phòng đã khóa — Chờ đếm ngược"
- COUNTDOWN: đếm ngược 30s lớn
- SPINNING: animation quay (slot nào có người mới quay)
- RESULT: reveal kết quả từng slot
- DONE: "Đã hoàn thành — Xem kết quả bên dưới"

---

## 2.5 Màn Hình Kết Quả Cá Nhân (/result)

```
┌─────────────────────────────────────────────┐
│  🎉 Chúc mừng Nguyễn Thị A! 🎉              │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         [Ảnh kết quả 1080x1350]    │    │
│  │  Selfie + Template + Badge giải    │    │
│  │  "Giải Khuyến Khích — 210.000đ"   │    │
│  │  Logo công ty + ngày 8/3/2026     │    │
│  └─────────────────────────────────────┘   │
│                                              │
│  Giải thưởng: 🎁 Giải Khuyến Khích           │
│  Giá trị: 210.000 VND                        │
│                                              │
│  [ 📤 SHARE FACEBOOK ]                       │
│  [ 💾 TẢI ẢNH VỀ ]                          │
│                                              │
│  📝 Caption gợi ý:                           │
│  "Hôm nay mình may mắn nhận được phần       │
│   thưởng trong sự kiện 8/3 của công ty!     │
│   #WomensDay #8thMarch #[TênCôngTy]"        │
│  [Copy Caption]                              │
└─────────────────────────────────────────────┘
```

---

## 2.6 Admin Dashboard (/admin)

```
┌──────────────────────────────────────────────────────────────────┐
│  🔧 ADMIN — Women's Day Spin Control Panel          [Logout]      │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐    │
│  │  EVENT CONTROL       │  │  PRIZE POOL STATUS               │   │
│  │  [▶ START EVENT]     │  │  Nhất:    1/1  [████░] 0 còn    │   │
│  │  [■ STOP EVENT]      │  │  Nhì:    10/10 [████░] 0 còn    │   │
│  │  [+ CREATE ROOM]     │  │  Ba:     12/20 [████░] 8 còn    │   │
│  └─────────────────────┘  │  KK:    100/369 [██░░░] 269 còn  │   │
│                            └─────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  ROOMS                                                      │  │
│  │  ID    │ Status    │ Participants │ Timer  │ Actions        │  │
│  │  R001  │ WAITING   │ 7/12        │ 00:18  │ [START][LOCK]  │  │
│  │  R002  │ SPINNING  │ 12/12       │ —      │ [VIEW]         │  │
│  │  R003  │ DONE      │ 5/12        │ —      │ [EXPORT]       │  │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌────────────────────────────────────┐  ┌────────────────────┐  │
│  │  CHAT MODERATION                    │  │  QUICK STATS       │  │
│  │  [user@dept]: message [🗑 Delete]   │  │  Đã quay: 185/400  │  │
│  │  [user@dept]: message [🔇 Mute]    │  │  Phòng xong: 15    │  │
│  │  ...                                │  │  Online: 312       │  │
│  └────────────────────────────────────┘  └────────────────────┘  │
│                                                                   │
│  [ 📊 EXPORT CSV KẾT QUẢ ]                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2.7 Màn Hình Livestream Wall (/wall) — Big Screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🌸 WOMEN'S DAY 8/3 — LIVE SPIN 🌸            [Logo Công Ty]              │
│                                                                           │
│  ┌───────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  QR JOIN ROOM #R001           │  │  PHÒNG #R001 — WAITING (7/12)   │  │
│  │                               │  │                                  │  │
│  │  [████ QR CODE ████]          │  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐           │  │
│  │                               │  │  │👩│ │👩│ │👩│ │  │  Row 1    │  │
│  │  Scan để tham gia!            │  │  │A │ │B │ │C │ │  │           │  │
│  │  Còn 5 chỗ trống              │  │  └──┘ └──┘ └──┘ └──┘           │  │
│  │                               │  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐           │  │
│  │  ⏱ Auto start: 00:18          │  │  │  │ │  │ │  │ │  │  Row 2    │  │
│  │                               │  │  └──┘ └──┘ └──┘ └──┘           │  │
│  │  ──────────────────           │  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐           │  │
│  │  💬 LIVE CHAT                 │  │  │  │ │  │ │  │ │  │  Row 3    │  │
│  │  Lan (KT): "Chúc mọi người"   │  │  └──┘ └──┘ └──┘ └──┘           │  │
│  │  Mai (HR): "Haha 🔥"          │  │                                  │  │
│  │  Thu (IT): "Mình sắp vào rồi" │  │  STATUS: ⏳ ĐANG CHỜ            │  │
│  │  [❤️][👏][🔥]                 │  │  Đang có: 7 người               │  │
│  │                               │  │  Tự động quay sau: 00:18         │  │
│  └───────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                           │
│  Đã hoàn thành hôm nay: 185 / 400 nhân viên          [♪ Sound: ON]      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Khi COUNTDOWN:**
```
│  ┌─────────────────────────────────────────────────────────┐          │
│  │              🔒 PHÒNG ĐÃ KHÓA                           │          │
│  │                                                          │          │
│  │                    30                                    │          │
│  │              (đếm ngược to)                              │          │
│  │                                                          │          │
│  │  [Avatar 1][Avatar 2][Avatar 3]...[Avatar 7]            │          │
│  └─────────────────────────────────────────────────────────┘          │
```

**Khi SPINNING / REVEAL:**
```
│  [Animation quay + beam effect + confetti]                             │
│  Slot 1: 🎁 Giải KK — 210K  ✨                                         │
│  Slot 2: 🥉 Giải Ba — 500K  ✨✨                                         │
│  Slot 3: 🥈 Giải Nhì — 1TR  🔥🔥🔥 (highlight đặc biệt)               │
│  ...                                                                    │
```

---

# 3. STATE MACHINE + SEQUENCE DIAGRAM

## 3.1 Room State Machine

```
                    ┌──────────┐
                    │  CREATED │  (admin tạo, chưa có ai)
                    └────┬─────┘
                         │ first participant joins
                         ▼
                    ┌──────────┐
                    │ WAITING  │◄────────────────────────────────┐
                    └────┬─────┘                                  │
                         │                                        │
           ┌─────────────┼─────────────────────┐                │
           │             │                      │                │
   Admin START NOW    WAITING timer         full (12/12)        │
     (any time)       reaches 30s          [auto lock]          │
           │             │                      │                │
           └─────────────▼──────────────────────┘                │
                    ┌──────────┐                                  │
                    │  LOCKED  │  (reject new join)               │
                    └────┬─────┘                                  │
                         │ COUNTDOWN 30s starts                   │
                         ▼                                        │
                    ┌──────────────┐                              │
                    │  COUNTDOWN   │  (30s, hiển thị đếm ngược)   │
                    └────┬─────────┘                              │
                         │ countdown = 0                          │
                         ▼                                        │
                    ┌──────────┐                                  │
                    │ SPINNING │  (server-side assign prizes)     │
                    └────┬─────┘                                  │
                         │ all prizes assigned                    │
                         ▼                                        │
                    ┌──────────┐                                  │
                    │  REVEAL  │  (sequential reveal per slot)    │
                    └────┬─────┘                                  │
                         │ all slots revealed                     │
                         ▼                                        │
                    ┌──────────┐
                    │   DONE   │  (final state)
                    └──────────┘
```

## 3.2 Participant State Machine

```
                    ┌────────────────┐
                    │  NOT_JOINED    │
                    └───────┬────────┘
                            │ scan QR + join (room WAITING)
                            ▼
                    ┌────────────────┐
                    │    JOINED      │  (slot assigned, waiting)
                    └───────┬────────┘
                            │ room → SPINNING
                            ▼
                    ┌────────────────┐
                    │    SPINNING    │  (animation playing)
                    └───────┬────────┘
                            │ prize assigned server-side
                            ▼
                    ┌────────────────┐
                    │    REVEALED    │  (result visible)
                    └───────┬────────┘
                            │ image generated
                            ▼
                    ┌────────────────┐
                    │     DONE       │  (can share/download)
                    └────────────────┘
```

## 3.3 Sequence Diagram — Join & Spin Flow

```
User          Frontend        Backend         DB           WebSocket
 │                │               │            │               │
 │ Scan QR        │               │            │               │
 │──────────────► │               │            │               │
 │                │ GET /room/:id │            │               │
 │                │──────────────►│            │               │
 │                │               │ SELECT room│               │
 │                │               │──────────► │               │
 │                │               │◄────────── │               │
 │                │◄──────────────│            │               │
 │                │               │            │               │
 │ (if WAITING)   │               │            │               │
 │                │ POST /room/join│            │               │
 │                │──────────────►│            │               │
 │                │               │ INSERT participant          │
 │                │               │──────────► │               │
 │                │               │◄────────── │               │
 │                │               │ EMIT participant_joined     │
 │                │               │────────────────────────────►│
 │                │               │            │           broadcast
 │◄──────────────►│               │            │           to all
 │  (slot shown)  │               │            │               │
 │                │               │            │               │
 │ [Timer 30s expires OR Admin START NOW]       │               │
 │                │               │            │               │
 │                │               │ UPDATE room status=LOCKED  │
 │                │               │──────────► │               │
 │                │               │ EMIT room_locked            │
 │                │               │────────────────────────────►│
 │                │◄──────────────────────────────────────────── │
 │  (UI: LOCKED)  │               │            │               │
 │                │               │ EMIT countdown_started(30s) │
 │                │               │────────────────────────────►│
 │                │◄──────────────────────────────────────────── │
 │  (countdown)   │               │            │               │
 │                │               │            │               │
 │ [countdown = 0]│               │            │               │
 │                │               │ BEGIN TRANSACTION           │
 │                │               │ For each participant:        │
 │                │               │   SELECT prize (random,      │
 │                │               │     FOR UPDATE SKIP LOCKED)  │
 │                │               │   UPDATE prize assigned=true │
 │                │               │   INSERT spin_log            │
 │                │               │ COMMIT                       │
 │                │               │ UPDATE room status=SPINNING  │
 │                │               │──────────► │               │
 │                │               │ EMIT spin_started           │
 │                │               │────────────────────────────►│
 │                │               │            │               │
 │                │               │ For each slot (delay 0.3s): │
 │                │               │   EMIT reveal_result        │
 │                │               │────────────────────────────►│
 │◄──────────────►│               │            │               │
 │  (reveal anim) │               │            │               │
 │                │               │            │               │
 │                │               │ EMIT room_results_ready     │
 │                │               │────────────────────────────►│
 │                │               │ UPDATE room status=DONE     │
 │                │               │──────────► │               │
 │                │               │            │               │
 │                │               │ [async] generate images     │
 │                │               │ for each participant         │
 │                │               │            │               │
```

## 3.4 Sequence Diagram — Auto Start Timer

```
Backend (Timer Service)              DB                WebSocket
        │                             │                    │
        │ [first participant joins]   │                    │
        │ startWaitingTimer(roomId)   │                    │
        │                             │                    │
        │ setTimer(30s)               │                    │
        │                             │                    │
        │ ... 30s elapsed ...         │                    │
        │                             │                    │
        │ checkRoomStatus(roomId)     │                    │
        │────────────────────────────►│                    │
        │◄──── status=WAITING ────────│                    │
        │                             │                    │
        │ lockRoom(roomId)            │                    │
        │────────────────────────────►│                    │
        │                             │                    │
        │ EMIT room_locked            │                    │
        │────────────────────────────────────────────────► │
        │                             │                    │
        │ startCountdown(30s)         │                    │
        │ EMIT countdown_started(30)  │                    │
        │────────────────────────────────────────────────► │
        │                             │                    │
        │ [each second]               │                    │
        │ EMIT countdown_tick(N)      │                    │
        │────────────────────────────────────────────────► │
        │                             │                    │
        │ [countdown = 0]             │                    │
        │ executeSpin(roomId)         │                    │
        │ → assign prizes transaction │                    │
        │────────────────────────────►│                    │
        │                             │                    │
        │ EMIT spin_started           │                    │
        │────────────────────────────────────────────────► │
```

---

# 4. API SPEC

**Base URL:** `https://internal.womanday.company/api/v1`
**Auth:** `Authorization: Bearer <JWT_TOKEN>`
**Content-Type:** `application/json`

---

## 4.1 Auth

### POST /auth/login
```json
// Request
{
  "employee_code": "NV001",
  "otp": "123456"
}

// Response 200
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "Nguyễn Thị A",
    "dept": "Kế Toán",
    "role": "user",
    "has_spun": false,
    "selfie_url": null,
    "card_template_id": null
  }
}

// Response 401
{
  "success": false,
  "error": "INVALID_OTP",
  "message": "OTP không hợp lệ hoặc đã hết hạn"
}
```

### POST /auth/request-otp
```json
// Request
{ "employee_code": "NV001" }

// Response 200
{ "success": true, "message": "OTP đã gửi đến email/Slack của bạn" }
```

---

## 4.2 User / Profile

### GET /me
```json
// Response 200
{
  "id": "uuid",
  "name": "Nguyễn Thị A",
  "employee_code": "NV001",
  "dept": "Kế Toán",
  "role": "user",
  "has_spun": false,
  "selfie_url": "https://cdn.../selfies/uuid.jpg",
  "card_template_id": 2,
  "card_image_url": "https://cdn.../cards/uuid.jpg",
  "result_image_url": null
}
```

---

## 4.3 Selfie & Card

### POST /selfie/upload
```
Content-Type: multipart/form-data
Body: file (image, max 3MB), template_id (1|2|3)
```
```json
// Response 200
{
  "success": true,
  "selfie_url": "https://cdn.../selfies/uuid.jpg",
  "card_image_url": "https://cdn.../cards/uuid.jpg",
  "message": "Thiệp đã được tạo thành công"
}

// Response 400
{
  "success": false,
  "error": "FILE_TOO_LARGE",
  "message": "Ảnh tối đa 3MB sau khi nén"
}
```

### GET /selfie/templates
```json
// Response 200
{
  "templates": [
    { "id": 1, "name": "Template Hoa Anh Đào", "preview_url": "...", "thumbnail_url": "..." },
    { "id": 2, "name": "Template Hoa Hồng", "preview_url": "...", "thumbnail_url": "..." },
    { "id": 3, "name": "Template Vàng Cổ Điển", "preview_url": "...", "thumbnail_url": "..." }
  ]
}
```

---

## 4.4 Rooms

### GET /rooms/current
```json
// Response 200 — phòng đang WAITING (chưa full, chưa lock)
{
  "room": {
    "id": "R001",
    "status": "WAITING",
    "capacity": 12,
    "participant_count": 7,
    "waiting_started_at": "2026-03-08T09:00:00Z",
    "auto_start_at": "2026-03-08T09:00:30Z",
    "qr_url": "https://internal.womanday.company/join?room=R001"
  }
}

// Response 404 — không có phòng WAITING
{ "room": null, "message": "Không có phòng trống. Chờ admin tạo phòng mới." }
```

### GET /rooms/:roomId
```json
// Response 200
{
  "id": "R001",
  "status": "WAITING",
  "capacity": 12,
  "participants": [
    {
      "slot_index": 1,
      "user_id": "uuid",
      "name": "Nguyễn Thị A",
      "dept": "Kế Toán",
      "selfie_url": "...",
      "state": "JOINED"
    },
    { "slot_index": 2, "user_id": null, "name": null, "state": "EMPTY" }
    // ... 12 slots total
  ],
  "waiting_started_at": "2026-03-08T09:00:00Z",
  "auto_start_at": "2026-03-08T09:00:30Z"
}
```

### POST /rooms/:roomId/join
```json
// Request (auth token required)
{}

// Response 200
{
  "success": true,
  "slot_index": 4,
  "room_id": "R001",
  "message": "Đã vào phòng thành công"
}

// Response 409 — already in room
{ "success": false, "error": "ALREADY_IN_ROOM", "message": "Bạn đã ở trong phòng này" }

// Response 423 — room locked
{ "success": false, "error": "ROOM_LOCKED", "message": "Phòng đã khóa. Vui lòng chờ phòng mới." }

// Response 403 — already spun
{ "success": false, "error": "ALREADY_SPUN", "message": "Bạn đã tham gia quay thưởng" }
```

### GET /rooms/:roomId/results
```json
// Response 200 (after DONE)
{
  "room_id": "R001",
  "results": [
    {
      "slot_index": 1,
      "user_id": "uuid",
      "name": "Nguyễn Thị A",
      "dept": "Kế Toán",
      "tier": "CONS",
      "value": 210000,
      "result_image_url": "https://cdn.../results/uuid.jpg"
    }
    // ...
  ]
}
```

---

## 4.5 Admin — Rooms

### POST /admin/rooms (Create Room)
```json
// Response 201
{
  "room": {
    "id": "R002",
    "status": "CREATED",
    "qr_url": "https://internal.womanday.company/join?room=R002",
    "qr_image_url": "https://cdn.../qr/R002.png"
  }
}
```

### POST /admin/rooms/:roomId/start-now
```json
// Response 200
{ "success": true, "message": "Phòng sẽ chuyển LOCK + COUNTDOWN 30s" }

// Response 400
{ "success": false, "error": "ROOM_NOT_WAITING", "message": "Phòng không ở trạng thái WAITING" }
```

### POST /admin/rooms/:roomId/lock
```json
// Response 200
{ "success": true, "room_id": "R001", "status": "LOCKED" }
```

### GET /admin/rooms
```json
// Response 200
{
  "rooms": [
    {
      "id": "R001",
      "status": "WAITING",
      "participant_count": 7,
      "created_at": "2026-03-08T08:55:00Z",
      "waiting_seconds_elapsed": 12
    }
  ],
  "total_rooms": 1
}
```

---

## 4.6 Admin — Event

### POST /admin/event/start
```json
// Response 200
{ "success": true, "event_status": "RUNNING" }
```

### POST /admin/event/stop
```json
// Response 200
{ "success": true, "event_status": "STOPPED" }
```

### GET /admin/stats
```json
// Response 200
{
  "total_participants": 400,
  "spun_count": 185,
  "remaining_count": 215,
  "prize_pool": {
    "FIRST":  { "total": 1,   "assigned": 1,   "remaining": 0 },
    "SECOND": { "total": 10,  "assigned": 7,   "remaining": 3 },
    "THIRD":  { "total": 20,  "assigned": 15,  "remaining": 5 },
    "CONS":   { "total": 369, "assigned": 162, "remaining": 207 }
  },
  "active_rooms": 3,
  "online_viewers": 312
}
```

### GET /admin/export/results
```
Response: CSV file
Content-Disposition: attachment; filename="results_20260308.csv"

employee_code,name,dept,tier,value,room_id,spun_at
NV001,Nguyễn Thị A,Kế Toán,CONS,210000,R001,2026-03-08T09:00:45Z
...
```

---

## 4.7 Admin — Chat Moderation

### DELETE /admin/chat/:messageId
```json
// Response 200
{ "success": true, "message_id": "uuid", "action": "deleted" }
```

### POST /admin/chat/mute/:userId
```json
// Request
{ "duration_minutes": 10 }

// Response 200
{ "success": true, "user_id": "uuid", "muted_until": "2026-03-08T09:15:00Z" }
```

---

## 4.8 Chat

### GET /chat/messages?room_id=R001&limit=50
```json
// Response 200
{
  "messages": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Trần Thị B",
      "dept": "HR",
      "message": "Chúc mọi người may mắn! 🌸",
      "type": "user",
      "created_at": "2026-03-08T09:00:05Z",
      "reactions": { "❤️": 5, "👏": 2, "🔥": 1 }
    }
  ]
}
```

### POST /chat/message
```json
// Request
{
  "room_id": "R001",
  "message": "Haha chúc mừng chị Lan!"
}

// Response 200
{ "success": true, "message_id": "uuid" }

// Response 429 — rate limit
{ "success": false, "error": "RATE_LIMITED", "message": "Chờ 3 giây trước khi gửi tiếp" }
```

### POST /chat/react
```json
// Request
{ "message_id": "uuid", "reaction": "❤️" }

// Response 200
{ "success": true }
```

---

## 4.9 Result Image

### GET /result/image
```json
// Response 200 (sau khi spin DONE)
{
  "result_image_url": "https://cdn.../results/uuid.jpg",
  "caption": "Hôm nay mình may mắn nhận được Giải Khuyến Khích trị giá 210.000đ trong sự kiện 8/3 của công ty! 🌸 #WomensDay #8thMarch",
  "share_url": "https://www.facebook.com/sharer/sharer.php?u=..."
}
```

---

# 5. REALTIME EVENT SPEC (WebSocket / Socket.IO)

**Namespace:** `/room`
**Connection:** `wss://internal.womanday.company/socket.io`
**Auth:** query param `?token=JWT_TOKEN`

## 5.1 Client → Server Events

| Event | Payload | Mô tả |
|-------|---------|--------|
| `join_room` | `{ room_id }` | Subscribe vào room channel |
| `leave_room` | `{ room_id }` | Unsubscribe khỏi room |
| `send_chat` | `{ room_id, message }` | Gửi tin nhắn chat |
| `send_reaction` | `{ message_id, reaction }` | Thêm reaction |
| `admin_start_now` | `{ room_id }` | Admin trigger start |
| `admin_lock_room` | `{ room_id }` | Admin lock room |
| `admin_delete_msg` | `{ message_id }` | Admin xoá tin nhắn |
| `admin_mute_user` | `{ user_id, duration_minutes }` | Admin mute user |

## 5.2 Server → Client Events

### `room_created`
```json
{
  "event": "room_created",
  "room_id": "R002",
  "qr_url": "https://internal.womanday.company/join?room=R002",
  "created_at": "2026-03-08T09:05:00Z"
}
```

### `participant_joined`
```json
{
  "event": "participant_joined",
  "room_id": "R001",
  "slot_index": 4,
  "participant": {
    "user_id": "uuid",
    "name": "Lê Thị C",
    "dept": "Marketing",
    "selfie_url": "https://cdn.../selfies/uuid.jpg"
  },
  "participant_count": 8,
  "total_capacity": 12
}
```

### `room_locked`
```json
{
  "event": "room_locked",
  "room_id": "R001",
  "reason": "ADMIN_TRIGGERED" | "TIMER_EXPIRED" | "ROOM_FULL",
  "participant_count": 7,
  "locked_at": "2026-03-08T09:00:30Z"
}
```

### `countdown_started`
```json
{
  "event": "countdown_started",
  "room_id": "R001",
  "remaining_seconds": 30,
  "spin_at": "2026-03-08T09:01:00Z"
}
```

### `countdown_tick`
```json
{
  "event": "countdown_tick",
  "room_id": "R001",
  "remaining_seconds": 15
}
```

### `spin_started`
```json
{
  "event": "spin_started",
  "room_id": "R001",
  "participant_count": 7,
  "started_at": "2026-03-08T09:01:00Z"
}
```

### `reveal_result`
```json
{
  "event": "reveal_result",
  "room_id": "R001",
  "slot_index": 3,
  "sequence": 3,
  "total_slots": 7,
  "user": {
    "user_id": "uuid",
    "name": "Trần Thị B",
    "dept": "HR",
    "selfie_url": "..."
  },
  "prize": {
    "tier": "SECOND",
    "value": 1000000,
    "label": "Giải Nhì — 1.000.000đ"
  },
  "is_high_tier": true
}
```

### `room_results_ready`
```json
{
  "event": "room_results_ready",
  "room_id": "R001",
  "results": [
    {
      "slot_index": 1,
      "name": "Nguyễn Thị A",
      "dept": "Kế Toán",
      "tier": "CONS",
      "value": 210000,
      "result_image_url": "..."
    }
  ],
  "summary": {
    "FIRST": 0,
    "SECOND": 1,
    "THIRD": 0,
    "CONS": 6
  }
}
```

### `chat_message`
```json
{
  "event": "chat_message",
  "id": "uuid",
  "room_id": "R001",
  "user": {
    "user_id": "uuid",
    "name": "Mai Thị D",
    "dept": "IT"
  },
  "message": "Chúc mừng chị Lan! 🎉",
  "type": "user",
  "reactions": {},
  "created_at": "2026-03-08T09:00:10Z"
}
```

### `reaction_updated`
```json
{
  "event": "reaction_updated",
  "message_id": "uuid",
  "reactions": { "❤️": 8, "👏": 3, "🔥": 2 }
}
```

### `moderation_action`
```json
{
  "event": "moderation_action",
  "action": "DELETE_MESSAGE" | "MUTE_USER",
  "message_id": "uuid",
  "user_id": "uuid",
  "reason": "spam"
}
```

### `image_ready`
```json
{
  "event": "image_ready",
  "user_id": "uuid",
  "type": "result",
  "image_url": "https://cdn.../results/uuid.jpg"
}
```

### `system_message`
```json
{
  "event": "system_message",
  "room_id": "R001",
  "message": "Phòng R001 đã bắt đầu quay thưởng!",
  "type": "info"
}
```

---

# 6. DATABASE SCHEMA (SQL DDL)

```sql
-- ============================================================
-- Women's Day Spin — Database Schema v1.0
-- PostgreSQL 15+
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS / EMPLOYEES
-- ============================================================
CREATE TABLE employees (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code     VARCHAR(20) NOT NULL UNIQUE,
    name              VARCHAR(100) NOT NULL,
    dept              VARCHAR(100) NOT NULL,
    email             VARCHAR(200),
    role              VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    has_spun          BOOLEAN NOT NULL DEFAULT FALSE,
    selfie_url        TEXT,
    card_template_id  INTEGER,
    card_image_url    TEXT,
    result_image_url  TEXT,
    is_muted          BOOLEAN NOT NULL DEFAULT FALSE,
    muted_until       TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_employees_has_spun ON employees(has_spun);

-- ============================================================
-- OTP (One-Time Passwords)
-- ============================================================
CREATE TABLE otp_tokens (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token_hash    VARCHAR(64) NOT NULL,  -- SHA256 of OTP
    expires_at    TIMESTAMPTZ NOT NULL,
    used          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_employee ON otp_tokens(employee_id, expires_at);

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE rooms (
    id                  VARCHAR(10) PRIMARY KEY,  -- e.g. 'R001'
    status              VARCHAR(20) NOT NULL DEFAULT 'CREATED'
                        CHECK (status IN ('CREATED','WAITING','LOCKED','COUNTDOWN','SPINNING','REVEAL','DONE')),
    capacity            INTEGER NOT NULL DEFAULT 12,
    created_by          UUID REFERENCES employees(id),
    waiting_started_at  TIMESTAMPTZ,   -- khi first participant join
    auto_start_at       TIMESTAMPTZ,   -- waiting_started_at + 30s
    locked_at           TIMESTAMPTZ,
    countdown_started_at TIMESTAMPTZ,
    spin_started_at     TIMESTAMPTZ,
    done_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_status ON rooms(status);

-- ============================================================
-- ROOM PARTICIPANTS
-- ============================================================
CREATE TABLE room_participants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     VARCHAR(10) NOT NULL REFERENCES rooms(id),
    user_id     UUID NOT NULL REFERENCES employees(id),
    slot_index  INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 12),
    state       VARCHAR(20) NOT NULL DEFAULT 'JOINED'
                CHECK (state IN ('JOINED','SPINNING','REVEALED','DONE')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, user_id),
    UNIQUE (room_id, slot_index)
);

CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);

-- ============================================================
-- PRIZE POOL (Pre-generated, 400 prizes)
-- ============================================================
CREATE TABLE prize_pool (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier            VARCHAR(10) NOT NULL CHECK (tier IN ('FIRST','SECOND','THIRD','CONS')),
    value           INTEGER NOT NULL,
    assigned        BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_to     UUID REFERENCES employees(id),
    assigned_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prize_pool_unassigned ON prize_pool(tier, assigned) WHERE assigned = FALSE;
CREATE INDEX idx_prize_pool_assigned_to ON prize_pool(assigned_to);

-- Seed: 1 FIRST + 10 SECOND + 20 THIRD + 369 CONS
-- Run seed script after schema creation

-- ============================================================
-- SPIN LOGS (Audit trail)
-- ============================================================
CREATE TABLE spin_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     VARCHAR(10) NOT NULL REFERENCES rooms(id),
    user_id     UUID NOT NULL REFERENCES employees(id),
    prize_id    UUID NOT NULL REFERENCES prize_pool(id),
    tier        VARCHAR(10) NOT NULL,
    value       INTEGER NOT NULL,
    slot_index  INTEGER NOT NULL,
    spun_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)  -- Mỗi user chỉ spin 1 lần
);

CREATE INDEX idx_spin_logs_room ON spin_logs(room_id);
CREATE INDEX idx_spin_logs_user ON spin_logs(user_id);

-- ============================================================
-- GENERATED IMAGES
-- ============================================================
CREATE TABLE generated_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES employees(id),
    room_id     VARCHAR(10) REFERENCES rooms(id),
    type        VARCHAR(10) NOT NULL CHECK (type IN ('card','result')),
    image_url   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_images_user ON generated_images(user_id, type);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     VARCHAR(10) REFERENCES rooms(id),  -- NULL = global chat
    user_id     UUID NOT NULL REFERENCES employees(id),
    message     TEXT NOT NULL CHECK (LENGTH(message) <= 300),
    type        VARCHAR(10) NOT NULL DEFAULT 'user'
                CHECK (type IN ('user','system','admin')),
    reactions   JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,  -- soft delete
    deleted_by  UUID REFERENCES employees(id)
);

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_not_deleted ON chat_messages(room_id) WHERE deleted_at IS NULL;

-- ============================================================
-- RATE LIMITING (Redis preferred, DB fallback)
-- ============================================================
CREATE TABLE rate_limits (
    user_id     UUID NOT NULL REFERENCES employees(id),
    action      VARCHAR(50) NOT NULL,
    count       INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, action)
);

-- ============================================================
-- EVENT CONFIG
-- ============================================================
CREATE TABLE event_config (
    key         VARCHAR(50) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO event_config (key, value) VALUES
    ('event_status', 'PENDING'),
    ('waiting_timer_seconds', '30'),
    ('countdown_seconds', '30'),
    ('max_room_capacity', '12');

-- ============================================================
-- PRIZE POOL SEED FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION seed_prize_pool() RETURNS VOID AS $$
DECLARE
    i INTEGER;
BEGIN
    -- 1 giải nhất
    INSERT INTO prize_pool (tier, value) VALUES ('FIRST', 2500000);

    -- 10 giải nhì
    FOR i IN 1..10 LOOP
        INSERT INTO prize_pool (tier, value) VALUES ('SECOND', 1000000);
    END LOOP;

    -- 20 giải ba
    FOR i IN 1..20 LOOP
        INSERT INTO prize_pool (tier, value) VALUES ('THIRD', 500000);
    END LOOP;

    -- 369 giải khuyến khích
    FOR i IN 1..369 LOOP
        INSERT INTO prize_pool (tier, value) VALUES ('CONS', 210000);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Chạy seed: SELECT seed_prize_pool();
```

---

# 7. PSEUDOCODE CÁC LUỒNG CHÍNH

## 7.1 Join Room

```pseudocode
FUNCTION joinRoom(userId, roomId):

  // 1. Validate user
  user = DB.getUser(userId)
  IF user.has_spun:
    RETURN ERROR("ALREADY_SPUN", 403)

  // 2. Validate room
  room = DB.getRoom(roomId)
  IF room IS NULL:
    RETURN ERROR("ROOM_NOT_FOUND", 404)

  IF room.status NOT IN ['WAITING']:
    RETURN ERROR("ROOM_LOCKED", 423)

  // 3. Check duplicate
  existing = DB.getRoomParticipant(roomId, userId)
  IF existing IS NOT NULL:
    RETURN ERROR("ALREADY_IN_ROOM", 409)

  // 4. Find next empty slot (atomic)
  BEGIN TRANSACTION
    participants = DB.getParticipants(roomId, LOCK=true)
    IF participants.count >= room.capacity:
      ROLLBACK
      RETURN ERROR("ROOM_FULL", 409)

    usedSlots = participants.map(p => p.slot_index)
    nextSlot = findFirstAvailable([1..12], usedSlots)

    DB.insertParticipant({
      room_id: roomId,
      user_id: userId,
      slot_index: nextSlot,
      state: 'JOINED'
    })

    // First participant triggers waiting timer
    IF participants.count == 0:
      waitingStart = NOW()
      autoStartAt = waitingStart + 30s
      DB.updateRoom(roomId, {
        status: 'WAITING',
        waiting_started_at: waitingStart,
        auto_start_at: autoStartAt
      })
      TimerService.scheduleAutoLock(roomId, 30s)

    // Room full → auto lock
    IF participants.count + 1 == room.capacity:
      TimerService.cancelAutoLock(roomId)
      CALL lockRoom(roomId, reason='ROOM_FULL')

  COMMIT

  // 5. Emit realtime event
  WS.emit('participant_joined', {
    room_id: roomId,
    slot_index: nextSlot,
    participant: { user_id: userId, name: user.name, dept: user.dept, selfie_url: user.selfie_url },
    participant_count: participants.count + 1
  })

  RETURN SUCCESS({ slot_index: nextSlot })
```

## 7.2 Lock Room

```pseudocode
FUNCTION lockRoom(roomId, reason):

  BEGIN TRANSACTION
    room = DB.getRoom(roomId, LOCK=true)

    IF room.status != 'WAITING':
      ROLLBACK
      RETURN  // idempotent, đã lock rồi

    DB.updateRoom(roomId, {
      status: 'LOCKED',
      locked_at: NOW()
    })
  COMMIT

  WS.emit('room_locked', {
    room_id: roomId,
    reason: reason,
    participant_count: DB.countParticipants(roomId),
    locked_at: NOW()
  })

  // Immediately start countdown
  CALL startCountdown(roomId)
```

## 7.3 Countdown + Auto Spin

```pseudocode
FUNCTION startCountdown(roomId):

  DB.updateRoom(roomId, {
    status: 'COUNTDOWN',
    countdown_started_at: NOW()
  })

  WS.emit('countdown_started', {
    room_id: roomId,
    remaining_seconds: 30,
    spin_at: NOW() + 30s
  })

  // Tick every second
  FOR sec = 29 DOWNTO 1:
    WAIT 1s
    WS.emit('countdown_tick', {
      room_id: roomId,
      remaining_seconds: sec
    })

  WAIT 1s
  // Countdown done → execute spin
  CALL executeSpin(roomId)
```

## 7.4 Spin (Prize Assignment)

```pseudocode
FUNCTION executeSpin(roomId):

  // 1. Lock room as SPINNING
  DB.updateRoom(roomId, {
    status: 'SPINNING',
    spin_started_at: NOW()
  })

  WS.emit('spin_started', {
    room_id: roomId,
    started_at: NOW()
  })

  // 2. Get participants (ordered by slot)
  participants = DB.getParticipants(roomId, orderBy='slot_index')

  results = []

  BEGIN TRANSACTION (SERIALIZABLE)
    FOR EACH participant IN participants:

      // Idempotent check: already has spin_log?
      existingLog = DB.getSpinLog(participant.user_id)
      IF existingLog IS NOT NULL:
        results.append(existingLog)
        CONTINUE

      // Random select unassigned prize
      // Use SKIP LOCKED to avoid deadlock
      prize = DB.query("""
        SELECT id, tier, value FROM prize_pool
        WHERE assigned = FALSE
        ORDER BY RANDOM()
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      """)

      IF prize IS NULL:
        ROLLBACK
        LOG.error("Prize pool exhausted! Room: " + roomId)
        WS.emit('system_message', { message: 'Lỗi hệ thống: Hết phần thưởng', type: 'error' })
        RETURN

      // Mark prize assigned
      DB.updatePrize(prize.id, {
        assigned: true,
        assigned_to: participant.user_id,
        assigned_at: NOW()
      })

      // Log spin
      DB.insertSpinLog({
        room_id: roomId,
        user_id: participant.user_id,
        prize_id: prize.id,
        tier: prize.tier,
        value: prize.value,
        slot_index: participant.slot_index
      })

      // Mark user as spun
      DB.updateEmployee(participant.user_id, { has_spun: true })

      results.append({
        slot_index: participant.slot_index,
        user: participant,
        prize: prize
      })

  COMMIT

  // 3. Reveal results sequentially (drama effect)
  DB.updateRoom(roomId, { status: 'REVEAL' })

  results = sortBy(results, 'slot_index')
  FOR i, result IN enumerate(results):
    WAIT 300ms  // delay between reveals

    WS.emit('reveal_result', {
      room_id: roomId,
      slot_index: result.slot_index,
      sequence: i + 1,
      total_slots: results.length,
      user: result.user,
      prize: { tier: result.prize.tier, value: result.prize.value },
      is_high_tier: result.prize.tier IN ['FIRST', 'SECOND', 'THIRD']
    })

  WAIT 2s  // final pause

  // 4. Room done
  DB.updateRoom(roomId, { status: 'DONE', done_at: NOW() })

  WS.emit('room_results_ready', {
    room_id: roomId,
    results: results.map(r => { ...r.user, ...r.prize })
  })

  // 5. Async: generate result images for each participant
  FOR EACH result IN results:
    ASYNC generateResultImage(result.user.user_id, result.prize, roomId)
```

## 7.5 Auto Start Timer Service

```pseudocode
CLASS TimerService:

  timers = {}  // roomId → timerHandle

  FUNCTION scheduleAutoLock(roomId, delaySeconds):
    // Cancel any existing timer for this room
    IF timers[roomId] EXISTS:
      CALL cancelAutoLock(roomId)

    timers[roomId] = setTimeout(delaySeconds * 1000, ASYNC FUNCTION():
      room = DB.getRoom(roomId)
      IF room.status == 'WAITING':
        LOG.info("Auto-locking room " + roomId + " due to timer expiry")
        CALL lockRoom(roomId, reason='TIMER_EXPIRED')
      DELETE timers[roomId]
    )

  FUNCTION cancelAutoLock(roomId):
    IF timers[roomId] EXISTS:
      clearTimeout(timers[roomId])
      DELETE timers[roomId]

  // On server restart: recover active rooms
  FUNCTION recoverOnStartup():
    waitingRooms = DB.query("SELECT * FROM rooms WHERE status='WAITING' AND auto_start_at IS NOT NULL")
    FOR EACH room IN waitingRooms:
      remainingMs = room.auto_start_at - NOW()
      IF remainingMs > 0:
        CALL scheduleAutoLock(room.id, remainingMs / 1000)
      ELSE:
        // Timer already expired during downtime
        CALL lockRoom(room.id, reason='TIMER_EXPIRED')
```

## 7.6 Generate Result Image

```pseudocode
FUNCTION generateResultImage(userId, prize, roomId):

  user = DB.getUser(userId)

  // 1. Load base template (1080x1350)
  templatePath = TEMPLATES_DIR + "/" + user.card_template_id + "_result.png"
  image = sharp(templatePath)

  // 2. Load selfie (rounded circle crop)
  selfie = sharp(user.selfie_url_local)
    .resize(300, 300)
    .composite([{
      input: CIRCLE_MASK_300px,
      blend: 'dest-in'
    }])

  // 3. Build text layers
  textLayers = [
    { text: user.name,       x: 540, y: 900, font: 'Bold 48px Montserrat', color: '#FFFFFF', align: 'center' },
    { text: user.dept,       x: 540, y: 960, font: '32px Montserrat',       color: '#FFD700', align: 'center' },
    { text: prize.label,     x: 540, y: 1050, font: 'Bold 56px Montserrat', color: '#FFFFFF', align: 'center' },
    { text: prize.value_str, x: 540, y: 1120, font: 'Bold 72px Montserrat', color: '#FFD700', align: 'center' },
    { text: "8/3/2026",      x: 540, y: 1250, font: '28px Montserrat',      color: '#FFFFFF', align: 'center' }
  ]

  // 4. Badge overlay (giải cao có badge đặc biệt)
  IF prize.tier == 'FIRST':
    badge = BADGE_FIRST  // crown + glow
  ELSE IF prize.tier == 'SECOND':
    badge = BADGE_SECOND
  ELSE IF prize.tier == 'THIRD':
    badge = BADGE_THIRD
  ELSE:
    badge = BADGE_CONS

  // 5. Logo
  logo = LOGO_PNG resized to 200x80

  // 6. Composite layers
  finalImage = image
    .composite([
      { input: selfie_buffer,  left: 390, top: 520 },  // centered selfie
      { input: badge_buffer,   left: 800, top: 500 },  // badge top-right of selfie
      { input: logo_buffer,    left: 440, top: 50  },  // logo top center
      ...textLayers.map(layer => renderTextToBuffer(layer))
    ])
    .jpeg({ quality: 90 })

  // 7. Save to CDN
  outputBuffer = AWAIT finalImage.toBuffer()
  cdnUrl = AWAIT CDN.upload(outputBuffer, "results/" + userId + ".jpg")

  // 8. Update DB
  DB.updateEmployee(userId, { result_image_url: cdnUrl })
  DB.insertGeneratedImage({
    user_id: userId, room_id: roomId,
    type: 'result', image_url: cdnUrl
  })

  // 9. Notify user via WebSocket
  WS.emitToUser(userId, 'image_ready', {
    type: 'result',
    image_url: cdnUrl
  })

  RETURN cdnUrl
```

## 7.7 Admin Start Now

```pseudocode
FUNCTION adminStartNow(adminUserId, roomId):

  // Auth check
  admin = DB.getUser(adminUserId)
  IF admin.role != 'admin':
    RETURN ERROR("FORBIDDEN", 403)

  room = DB.getRoom(roomId)
  IF room IS NULL:
    RETURN ERROR("ROOM_NOT_FOUND", 404)

  IF room.status != 'WAITING':
    RETURN ERROR("ROOM_NOT_WAITING", 400)

  participants = DB.countParticipants(roomId)
  IF participants == 0:
    RETURN ERROR("ROOM_EMPTY", 400)

  // Cancel any auto-lock timer
  TimerService.cancelAutoLock(roomId)

  // Lock and start countdown
  CALL lockRoom(roomId, reason='ADMIN_TRIGGERED')
  // lockRoom sẽ emit room_locked và gọi startCountdown

  RETURN SUCCESS({ message: "Room đang đếm ngược 30s trước khi quay" })
```

---

# 8. CHECKLIST VẬN HÀNH SỰ KIỆN (RUNBOOK)

## 8.1 Trước Sự Kiện (T-7 ngày)

- [ ] Thu thập danh sách nhân viên nữ từ HR (CSV: employee_code, name, dept, email)
- [ ] Import CSV vào DB (`employees` table)
- [ ] Chạy seed prize pool: `SELECT seed_prize_pool();`
- [ ] Verify prize count: 1+10+20+369 = 400 rows trong `prize_pool`
- [ ] Chuẩn bị 3 template thiệp (design team) — xuất PNG 1080x1350
- [ ] Chuẩn bị badge icon (FIRST/SECOND/THIRD/CONS)
- [ ] Chuẩn bị font (embed trong server, fallback)
- [ ] Test upload selfie + generate card image
- [ ] Test generate result image
- [ ] Test WebSocket connection (100 concurrent)
- [ ] Test QR scan → join room → spin flow (end-to-end)

## 8.2 Trước Sự Kiện (T-1 ngày)

- [ ] Deploy lên server production (nội bộ)
- [ ] Test load: 300 concurrent connections WebSocket
- [ ] Cấu hình CDN / storage bucket
- [ ] Test OTP flow (email/Slack)
- [ ] Tạo tài khoản admin cho người điều hành
- [ ] Test admin dashboard: tạo phòng, START NOW, export CSV
- [ ] Kết nối màn hình LED/TV → mở /wall trên browser
- [ ] Kết nối laptop admin → mở /admin trên browser
- [ ] Test sound on/off trên màn hình /wall
- [ ] Briefing MC/Host về kịch bản điều hành
- [ ] Tạo sẵn 5 phòng rỗng trong DB (status=CREATED), không public QR

## 8.3 Ngày Sự Kiện — Trước Livestream (08:00 - 09:00)

- [ ] **08:00** Bật server, kiểm tra uptime
- [ ] **08:10** Admin mở /admin dashboard → sẵn sàng
- [ ] **08:15** Mở trang /wall trên màn hình LED (full screen, no toolbar)
- [ ] **08:20** Test chat: gửi 1 tin nhắn system "Chào mừng sự kiện 8/3!"
- [ ] **08:30** Nhân viên bắt đầu đăng nhập + upload selfie (thông báo qua Slack/email)
- [ ] **08:50** Kiểm tra số người đã hoàn thành selfie (admin stats)
- [ ] **08:55** Admin click START EVENT
- [ ] **08:58** Admin tạo phòng đầu tiên → QR hiện trên /wall

## 8.4 Ngày Sự Kiện — Trong Livestream (09:00 onwards)

**Kịch bản mỗi phòng (~4-5 phút/phòng, 34 phòng ≈ ~2.5 giờ):**

```
[MC công bố] "Phòng R00X mở! Mời các chị scan QR tham gia!"
  → Admin create room → QR hiện trên /wall
  → Nhân viên scan QR → join room (avatar xuất hiện trong grid)

[30s sau first join] Auto-lock
  HOẶC [Admin bấm START NOW khi đủ người hoặc muốn đẩy nhanh]

[Đếm ngược 30s] MC tạo không khí: "Sắp quay rồi! 3...2...1..."

[AUTO SPIN] Animation trên màn hình LED
  → Reveal từng người một (0.3s delay)
  → Giải cao → highlight đặc biệt + âm thanh

[Kết quả] MC đọc tên giải thưởng từng người
  → Người thắng nhận ảnh cá nhân trên điện thoại
  → Khuyến khích share Facebook

[Admin] Tạo phòng tiếp theo (có thể tạo trước khi phòng cũ xong)
```

**Checklist trong mỗi phòng:**
- [ ] Kiểm tra prize pool còn đủ
- [ ] Monitor xem có lỗi WebSocket không
- [ ] Moderation chat nếu có spam
- [ ] Export từng phòng nếu cần

## 8.5 Sau Sự Kiện

- [ ] Admin click STOP EVENT
- [ ] Export CSV kết quả toàn bộ: `GET /admin/export/results`
- [ ] Verify: 400 rows trong `spin_logs`
- [ ] Verify: prize_pool có 0 unassigned
- [ ] Backup database
- [ ] Backup tất cả ảnh kết quả (CDN → local)
- [ ] Gửi báo cáo cho HR + Finance (CSV + tổng hợp)
- [ ] Thu hồi access token admin

## 8.6 Liên Lạc Khẩn Cấp

| Tình huống | Xử lý |
|-----------|--------|
| Server down | Restart service; nếu quá 2 phút → thông báo MC tạm dừng |
| WebSocket mất kết nối | Frontend tự reconnect (có retry logic); reload /wall |
| Prize pool lỗi | Dừng sự kiện, kiểm tra DB transaction; không spin tiếp |
| User không join được | Kiểm tra has_spun flag; admin check dashboard |
| Màn hình LED tắt | Reload browser /wall; backup laptop sẵn sàng |

---

# 9. TEST PLAN

## 9.1 Unit Tests

### Auth
- [ ] `requestOtp()` — gửi OTP và hash đúng
- [ ] `verifyOtp()` — đúng OTP → token; sai/hết hạn → lỗi
- [ ] `validateJwt()` — token hợp lệ/hết hạn/giả mạo

### Room Logic
- [ ] `joinRoom()` — join thành công, slot được assign đúng
- [ ] `joinRoom()` — reject nếu room LOCKED
- [ ] `joinRoom()` — reject nếu user đã spin
- [ ] `joinRoom()` — reject nếu room full (12/12)
- [ ] `lockRoom()` — idempotent (gọi 2 lần không lỗi)
- [ ] `startCountdown()` — emit đúng sequence
- [ ] `executeSpin()` — assign đúng số prize, đúng tier distribution
- [ ] `executeSpin()` — idempotent (gọi 2 lần → kết quả giống nhau)
- [ ] `adminStartNow()` — chỉ admin mới được gọi

### Prize Pool
- [ ] Seed 400 prizes → count đúng theo tier
- [ ] `assignPrize()` — transaction atomic, không assign trùng
- [ ] Khi prize pool < số participant → trả lỗi (không được xảy ra nếu logic đúng)

### Image Generation
- [ ] `generateResultImage()` — output đúng kích thước 1080x1350
- [ ] `generateResultImage()` — text wrap khi tên dài (>20 ký tự)
- [ ] `generateResultImage()` — font fallback khi thiếu glyph

## 9.2 Integration Tests

### Luồng đầy đủ (Happy Path)
```
Test: Full spin flow for 1 room with 3 participants
1. Login 3 users (NV001, NV002, NV003)
2. Upload selfie for each
3. Admin creates room R001
4. NV001 joins → check slot=1, status=WAITING, timer started
5. NV002 joins → check slot=2, participant_count=2
6. NV003 joins → check slot=3
7. Admin calls START NOW
8. Assert: room_locked event received by all clients
9. Assert: countdown_started(30) received
10. Wait 30s (or mock timer)
11. Assert: spin_started received
12. Assert: 3 × reveal_result events received (sequential)
13. Assert: room_results_ready received
14. Assert: spin_logs has 3 rows
15. Assert: prize_pool assigned=true for 3 prizes
16. Assert: NV001, NV002, NV003 have has_spun=true
17. Assert: result_image_url set for each user
```

### WebSocket Events
- [ ] Client receives `participant_joined` when another user joins same room
- [ ] Client receives `room_locked` and transitions UI
- [ ] Client receives `countdown_tick` every second
- [ ] Chat message broadcast to all clients in room
- [ ] Admin moderation: delete message → `moderation_action` received

### Rate Limiting
- [ ] Chat: user gửi 2 msgs trong 3s → 2nd rejected with RATE_LIMITED
- [ ] Chat: user gửi 1 msg mỗi 4s → accepted

## 9.3 Edge Cases

### E1: Disconnect Trong Khi WAITING
```
Scenario: User joins room, then loses connection (phone dies/leaves)
Expected:
- User vẫn giữ slot (không auto-remove)
- Nếu phòng quay → user vẫn nhận prize
- Result image vẫn được generate
- User reconnect sau → xem kết quả tại /result
```

### E2: Double Spin Attempt (Concurrent)
```
Scenario: 2 requests đồng thời gọi joinRoom cho cùng 1 user
Expected:
- Chỉ 1 request thành công (DB UNIQUE constraint trên room_participants(room_id, user_id))
- 2nd request trả 409 ALREADY_IN_ROOM
```

### E3: Late Join (Room đã LOCK)
```
Scenario: User scan QR nhưng room đã chuyển LOCKED/COUNTDOWN
Expected:
- API trả 423 ROOM_LOCKED
- UI hiển thị "Phòng đã khóa, vui lòng chờ phòng mới"
- Admin tạo phòng mới để user join
```

### E4: Phòng Rỗng (0 người khi timer hết)
```
Scenario: Admin tạo phòng nhưng không ai join trước khi timer start
Note: Timer chỉ bắt đầu khi first participant join → phòng rỗng không auto-start
Expected: Room ở trạng thái WAITING vô thời hạn cho đến khi có người join hoặc admin xử lý
```

### E5: Server Restart Giữa Chừng
```
Scenario: Server restart khi room đang COUNTDOWN
Expected:
- TimerService.recoverOnStartup() chạy
- Room ở COUNTDOWN → kiểm tra countdown_started_at
- Nếu countdown đã hết → executeSpin() immediately
- Nếu chưa hết → re-schedule timer với thời gian còn lại
- Emit countdown_started với remaining_seconds cập nhật
```

### E6: Prize Pool Gần Hết
```
Scenario: Còn 3 prizes nhưng có 5 người trong phòng cùng quay
Note: Không thể xảy ra nếu tổng participants <= 400 và prize_pool = 400
Expected (defensive): Transaction ROLLBACK, emit lỗi, admin alert
```

### E7: Admin START NOW Khi Phòng Chỉ Có 1 Người
```
Scenario: Admin bấm START NOW khi chỉ có 1 người trong phòng
Expected:
- Allowed (hard requirement: <12 được phép)
- 1 người quay, nhận 1 prize
- Kết quả bình thường
```

### E8: Concurrent Rooms (Multiple Phòng Cùng Spin)
```
Scenario: R001 và R002 cùng spin đồng thời (12+12=24 prize assignments)
Expected:
- DB transaction SERIALIZABLE đảm bảo không overlap
- Mỗi prize chỉ được assign 1 lần
- Không deadlock (SKIP LOCKED)
```

### E9: Ảnh Selfie Upload Lỗi
```
Scenario: User upload file > 3MB hoặc format sai
Expected:
- API trả 400 FILE_TOO_LARGE hoặc 400 INVALID_FORMAT
- Không lưu file
- User thử lại
```

### E10: Chat Spam / Injection
```
Scenario: User gửi <script>alert(1)</script> trong chat
Expected:
- Backend sanitize message (strip HTML tags)
- Rate limit áp dụng: 1 msg/3s
- Admin có th�� mute user
```

## 9.4 Load Test

**Công cụ:** k6 hoặc Artillery

### Scenario 1: 300 concurrent WebSocket viewers
```javascript
// k6 script pseudocode
VUs: 300
Duration: 10 minutes
Actions:
  - Connect WebSocket to /socket.io
  - Subscribe to room channel
  - Receive events (participant_joined, countdown, spin, reveal)
Assertions:
  - p95 event delivery latency < 500ms
  - 0 connection drops
  - 0 missed events
```

### Scenario 2: Concurrent join (12 users join 1 room simultaneously)
```
Concurrent: 12 requests POST /rooms/R001/join at the same time
Expected:
  - All 12 succeed (no duplicate slots)
  - slot_index 1-12 each assigned exactly once
  - No 500 errors
```

### Scenario 3: Chat rate limit under load
```
100 users sending chat messages simultaneously
Expected:
  - Messages within rate limit (1/3s) → 200
  - Excess messages → 429
  - System stable, no memory leak
```

---

# 10. DESIGN ASSETS CHECKLIST

## 10.1 Template Thiệp 8/3 (3 templates)

| Asset | Specs | Ghi chú |
|-------|-------|---------|
| Template base (PNG) | 1080×1350px, 72 DPI | Layer: background, decoration, safe zones |
| Safe zone selfie | 400×400px circle area, centered | Tọa độ cố định trong template |
| Safe zone text name | width max 800px, y=900px | Font override |
| Safe zone text dept | width max 800px, y=960px | |
| Safe zone text prize | width max 800px, y=1050px | |
| Safe zone text value | width max 800px, y=1120px | Color: #FFD700 |
| Safe zone date | width max 800px, y=1250px | |

**Template 1 — "Hoa Anh Đào":**
- Background: gradient pink/sakura
- Decoration: cherry blossom petals
- Accent color: #FF6B9D, #FFB3D0

**Template 2 — "Hoa Hồng Vàng":**
- Background: deep burgundy/gold
- Decoration: rose bouquet frame
- Accent color: #C0392B, #F1C40F

**Template 3 — "Tím Thanh Lịch":**
- Background: purple gradient
- Decoration: floral border minimalist
- Accent color: #8E44AD, #E8DAEF

## 10.2 Badge Giải Thưởng

| Badge | Size | Style |
|-------|------|-------|
| `badge_first.png` | 200×200px | Crown gold + glow effect |
| `badge_second.png` | 200×200px | Silver medal |
| `badge_third.png` | 200×200px | Bronze medal |
| `badge_cons.png` | 200×200px | Gift box / ribbon |

## 10.3 Logo

| Asset | Size | Format |
|-------|------|--------|
| `logo_main.png` | 400×160px | PNG transparent BG |
| `logo_white.png` | 400×160px | White version cho dark BG |
| `logo_small.png` | 200×80px | For result image |

## 10.4 Fonts (Embed vào Server)

| Font | Weight | Usage |
|------|--------|-------|
| Montserrat | Regular, Bold, ExtraBold | Text chính |
| Be Vietnam Pro | Regular, Bold | Tiếng Việt (diacritics đầy đủ) |
| Fallback | Arial Unicode | Khi thiếu glyph |

**Quy định typography:**
- Tên nhân viên: Bold 48px, white, max 2 lines (wrap nếu > 18 ký tự/line)
- Phòng ban: Regular 32px, accent color
- Tên giải: Bold 56px, white
- Giá trị: ExtraBold 72px, #FFD700
- Ngày: Regular 28px, white/opacity 80%

## 10.5 Animation Assets (/wall)

| Asset | Format | Usage |
|-------|--------|-------|
| `spin_bg.mp4` | WebM/MP4, loop | Background khi spinning |
| `confetti.json` | Lottie JSON | Confetti animation |
| `reveal_flash.png` | PNG sequence | Flash effect khi reveal |
| `beam_light.png` | PNG | Spotlight effect |

## 10.6 Sound Effects

| File | Duration | Usage |
|------|----------|-------|
| `countdown_tick.mp3` | 0.2s | Mỗi giây countdown |
| `spin_loop.mp3` | 3s loop | Trong lúc spinning |
| `reveal_normal.mp3` | 1s | Reveal KK/Ba |
| `reveal_special.mp3` | 2s | Reveal Nhì/Nhất (trumpet fanfare) |
| `confetti_pop.mp3` | 1s | Kết thúc reveal |

## 10.7 Color Palette

```css
/* Brand Colors */
--color-primary:     #FF6B9D;  /* Pink chủ đạo */
--color-secondary:   #FFD700;  /* Gold giải thưởng */
--color-accent:      #8E44AD;  /* Purple accent */

/* Prize Tier Colors */
--prize-first:       #FFD700;  /* Gold */
--prize-second:      #C0C0C0;  /* Silver */
--prize-third:       #CD7F32;  /* Bronze */
--prize-cons:        #4CAF50;  /* Green — "ai cũng có" */

/* UI */
--bg-wall:           #1A0A2E;  /* Dark purple cho màn hình LED */
--bg-card:           rgba(255,255,255,0.05); /* Glassmorphism */
--text-primary:      #FFFFFF;
--text-secondary:    rgba(255,255,255,0.7);

/* Status */
--status-waiting:    #3498DB;  /* Blue */
--status-locked:     #E74C3C;  /* Red */
--status-spinning:   #F39C12;  /* Orange */
--status-done:       #2ECC71;  /* Green */
```

## 10.8 QR Code Style

- Màu: primary #FF6B9D trên nền white
- Kích thước hiển thị trên /wall: 300×300px
- Corner radius: rounded squares
- Logo công ty ở giữa QR (20% QR size)
- Có chữ "Scan để tham gia!" bên dưới

## 10.9 Screen Layouts (Resolution)

| Màn hình | Resolution | Ghi chú |
|---------|-----------|---------|
| /wall (LED) | 1920×1080 | Landscape fullscreen |
| /join (Mobile) | 375×812+ | Portrait, mobile-first |
| /admin | 1280×800+ | Desktop browser |
| /result (Mobile) | 375×812+ | Portrait, share-ready |

---

# PHỤ LỤC

## A. Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/womanday

# Redis (rate limiting, room state cache)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<very-long-random-secret>
JWT_EXPIRES_IN=12h

# Storage (CDN)
S3_BUCKET=womanday-assets
S3_REGION=ap-southeast-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
CDN_BASE_URL=https://cdn.womanday.internal

# WebSocket
WS_CORS_ORIGIN=https://womanday.internal

# OTP (Email)
SMTP_HOST=smtp.company.internal
SMTP_PORT=587
SMTP_USER=noreply@company.com
SMTP_PASS=...

# Timer
WAITING_TIMER_SECONDS=30
COUNTDOWN_SECONDS=30
MAX_ROOM_CAPACITY=12
```

## B. Project Structure (Gợi ý)

```
womanday/
├── apps/
│   ├── web/          # Next.js frontend
│   │   ├── app/
│   │   │   ├── login/
│   │   │   ├── selfie/
│   │   │   ├── ready/
│   │   │   ├── join/
│   │   │   ├── result/
│   │   │   ├── wall/        # /wall — big screen
│   │   │   └── admin/
│   │   └── components/
│   │       ├── RoomGrid/
│   │       ├── SpinAnimation/
│   │       ├── ChatPanel/
│   │       └── CountdownTimer/
│   └── api/          # Node.js backend
│       ├── routes/
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── room.service.ts
│       │   ├── spin.service.ts
│       │   ├── timer.service.ts
│       │   ├── image.service.ts
│       │   └── chat.service.ts
│       ├── websocket/
│       └── workers/   # async image generation
├── packages/
│   ├── db/           # Prisma schema + migrations
│   └── types/        # Shared TypeScript types
├── assets/
│   ├── templates/    # 8/3 card templates
│   ├── badges/
│   ├── fonts/
│   └── sounds/
└── scripts/
    ├── seed-employees.ts
    ├── seed-prizes.ts
    └── export-results.ts
```

---

*Tài liệu này là toàn bộ thiết kế hệ thống Women's Day Live Spin 8/3.*
*Mọi thay đổi cần cập nhật đồng bộ database schema, API spec và realtime event spec.*
*Phiên bản: 1.0 — 2026-02-28*
