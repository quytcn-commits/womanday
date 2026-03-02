"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getUser } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      const user = getUser();
      if (!user?.selfieUrl) router.replace("/selfie");
      else router.replace("/ready");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-pink">
      <div className="text-brand-hot text-2xl animate-pulse">🌸 Đang tải...</div>
    </div>
  );
}
