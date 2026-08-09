"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/wall";

const BASE = 1_200_000;

export default function ViewerCount() {
  const [count, setCount] = useState<number>(() =>
    Math.round(BASE + Math.random() * 40_000),
  );
  const [bump, setBump] = useState(false);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => {
        const drift = Math.round((Math.random() - 0.5) * 2600);
        const pulse = Math.random() < 0.07 ? Math.round(Math.random() * 22000) : 0;
        return Math.max(900_000, c + drift + pulse);
      });
      if (Math.random() < 0.35) {
        setBump(true);
        if (bumpTimer.current) clearTimeout(bumpTimer.current);
        bumpTimer.current = setTimeout(() => setBump(false), 600);
      }
    }, 2200);
    return () => {
      clearInterval(id);
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
    };
  }, []);

  return (
    <span className="flex min-w-28 flex-col items-center gap-1 rounded-2xl border border-edge/70 bg-card/50 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
      <b
        className={`font-mono text-2xl leading-none text-gold transition-transform duration-300 ${
          bump ? "scale-110" : ""
        }`}
      >
        <span suppressHydrationWarning>👁 {formatCount(count)}</span>
      </b>
      viewers
    </span>
  );
}
