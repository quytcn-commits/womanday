import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Women's Day Spin 🌸 | 8/3/2026",
  description: "Mini game quay thưởng nội bộ sự kiện 8/3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
