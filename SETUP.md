# 🌸 WomanDay Spin — Setup Guide

## Yêu cầu
- Node.js >= 20
- Docker & Docker Compose
- npm >= 10

## 1. Cài đặt

```bash
# Clone / vào thư mục project
cd d:/womanday

# Cài dependencies toàn bộ monorepo
npm install

# Copy env (nếu chưa có)
cp .env.example .env
```

## 2. Khởi động database & redis

```bash
docker compose up -d
# Chờ 10-15s cho postgres khởi động
```

## 3. Tạo database schema

```bash
# Generate Prisma client
npm run db:generate

# Chạy migration (tạo bảng)
npm run db:migrate
# Nhập tên migration: "init"

# Seed dữ liệu (400 giải + 10 nhân viên demo + admin)
npm run db:seed
```

## 4. Chạy dev servers

```bash
npm run dev
# API: http://localhost:3001
# Web: http://localhost:3000
```

## 5. Truy cập

| URL | Mô tả |
|-----|--------|
| http://localhost:3000/login | Đăng nhập nhân viên |
| http://localhost:3000/admin | Admin dashboard |
| http://localhost:3000/wall | Màn hình livestream (big screen) |
| http://localhost:3001/health | API health check |

## 6. Tài khoản demo

| Loại | CCCD | Ngày sinh |
|------|------|-----------|
| Admin | 000000000000 | 01/01/1990 |
| Nhân viên 1 (Nguyễn Thị Lan) | 001090001234 | 08/03/1992 |
| Nhân viên 2 (Trần Thị Hoa) | 001090002234 | 15/05/1995 |
| Nhân viên 3 (Lê Thị Mai) | 001090003234 | 20/11/1993 |
| Nhân viên 4 (Phạm Thị Thu) | 001090004234 | 12/07/1990 |
| Nhân viên 5 (Hoàng Thị Hà) | 001090005234 | 28/02/1997 |

## 7. Import nhân viên thật (HR)

Tạo file CSV với format:
```csv
cccd,dob,name,position,dept
001234567890,08/03/1992,Nguyễn Thị Lan,Kế Toán Trưởng,Kế Toán
001234567891,15/05/1995,Trần Thị Hoa,Nhân Viên,HR
```

Vào Admin Dashboard → Nhấn "📥 Import CSV" → Chọn file.

## 8. Vận hành sự kiện

1. Mở http://localhost:3000/wall trên màn hình LED (fullscreen)
2. Mở http://localhost:3000/admin trên laptop admin
3. Admin bấm **▶ START EVENT**
4. Admin bấm **+ TẠO PHÒNG** → QR hiện trên wall
5. Nhân viên scan QR → join room
6. Admin bấm **▶ START NOW** hoặc chờ 30s auto-start
7. Animation quay → reveal kết quả
8. Lặp lại cho phòng tiếp theo

## 9. Design Assets (cần bổ sung)

Đặt các file sau vào `apps/api/public/templates/`:
- `template_1.png` — Template Hoa Anh Đào (1080×1350px)
- `template_2.png` — Template Hoa Hồng Vàng (1080×1350px)
- `template_3.png` — Template Tím Thanh Lịch (1080×1350px)
- `card_1.png`, `card_2.png`, `card_3.png` — Card templates

Nếu chưa có: hệ thống sẽ dùng gradient tím làm background mặc định.

## 10. Cấu trúc thư mục uploads

```
uploads/
├── selfies/     # Ảnh selfie của nhân viên
├── cards/       # Ảnh thiệp đã tạo
├── results/     # Ảnh kết quả quay thưởng
└── templates/   # Template previews
```
