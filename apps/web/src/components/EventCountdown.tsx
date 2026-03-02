"use client";

import { useEffect, useState } from "react";

interface Props {
  targetTime: string;
  onEventStarted: () => void;
}

export default function EventCountdown({ targetTime, onEventStarted }: Props) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = new Date(targetTime).getTime();

    function update() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setExpired(true);
        onEventStarted();
        return;
      }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime, onEventStarted]);

  if (expired) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="glass p-5 text-center">
      <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest mb-3">
        Su kien bat dau sau
      </p>
      <div className="flex items-center justify-center gap-3">
        {[
          { value: timeLeft.hours, label: "Gio" },
          { value: timeLeft.minutes, label: "Phut" },
          { value: timeLeft.seconds, label: "Giay" },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="glass px-4 py-3 rounded-xl min-w-[60px]"
              style={{
                background: "rgba(232,96,122,0.08)",
                border: "1px solid rgba(232,96,122,0.15)",
              }}
            >
              <span className="text-brand-hot font-black text-2xl tabular-nums">
                {pad(item.value)}
              </span>
            </div>
            <span className="text-brand-deep/40 text-[10px] mt-1 font-light uppercase tracking-wider">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-brand-deep/30 text-xs mt-3 font-light animate-pulse">
        Hay san sang cho su kien dac biet!
      </p>
    </div>
  );
}
