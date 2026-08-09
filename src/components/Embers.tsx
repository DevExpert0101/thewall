"use client";

import { useEffect, useRef } from "react";

export default function Embers() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const parts = Array.from({ length: 26 }, () => ({
      x: Math.random() * W,
      y: H + Math.random() * H * 0.3,
      r: 0.8 + Math.random() * 2.2,
      vy: 0.15 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.18,
      drift: Math.random() * Math.PI * 2,
      a: 0.35 + Math.random() * 0.6,
      hue: 18 + Math.random() * 26,
      bright: 52 + Math.random() * 14,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() * 0.001;
      for (const p of parts) {
        p.y -= p.vy;
        p.x += p.vx + Math.sin(t * 0.6 + p.drift) * 0.12;
        if (p.y < -12) {
          p.y = H + 12;
          p.x = Math.random() * W;
        }
        const tw = 0.55 + 0.45 * Math.sin(t * 2 + p.r * 12);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, ${p.a})`;
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.bright}%, ${p.a * tw})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-70 print:hidden"
    />
  );
}
