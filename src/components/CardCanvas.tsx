"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { downloadCanvas, MONO, SANS, wrapText } from "@/lib/canvas";
import { formatCount, formatMessageNumber, formatShortDate } from "@/lib/wall";

export interface CardCanvasHandle {
  download: () => void;
}

interface CardCanvasProps {
  content: string;
  messageNumber: number;
  reactions: number;
  wallDate: string;
  cardId: string;
  ref?: Ref<CardCanvasHandle>;
}

const W = 1200;
const H = 630;
const CX = W / 2;
const DISPLAY = '"Instrument Serif", Georgia, "Times New Roman", serif';

export default function CardCanvas({
  content,
  messageNumber,
  reactions,
  wallDate,
  cardId,
  ref,
}: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    download: () => {
      const canvas = canvasRef.current;
      if (canvas) downloadCanvas(canvas, `wall-card-${cardId}.png`);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.maxWidth = "100%";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // base
    ctx.fillStyle = "#0d0a07";
    ctx.fillRect(0, 0, W, H);

    // glow
    const glow = ctx.createRadialGradient(150, 120, 30, 150, 120, 480);
    glow.addColorStop(0, "rgba(255,122,26,0.20)");
    glow.addColorStop(1, "rgba(255,122,26,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // flame spine
    const spine = ctx.createLinearGradient(0, 0, 12, H);
    spine.addColorStop(0, "#ff9a3d");
    spine.addColorStop(0.5, "#ff7a1a");
    spine.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = spine;
    ctx.fillRect(0, 0, 12, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // THE WALL
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 46px ${SANS}`;
    ctx.letterSpacing = "16px";
    ctx.fillText("THE WALL", CX, 150);
    ctx.letterSpacing = "0px";

    // date
    ctx.fillStyle = "#6f6357";
    ctx.font = `400 26px ${MONO}`;
    ctx.fillText(formatShortDate(wallDate), CX, 206);

    // quote
    const quote = `“${content}”`;
    const msgGrad = ctx.createLinearGradient(0, 260, 0, 560);
    msgGrad.addColorStop(0, "#fff6ea");
    msgGrad.addColorStop(1, "#e0cba8");
    ctx.fillStyle = msgGrad;
    ctx.font = `italic 54px ${DISPLAY}`;
    const lines = wrapText(ctx, quote, 940, 5);
    const lineHeight = 76;
    let y = 330;
    for (const line of lines) {
      ctx.shadowColor = "rgba(255,122,26,0.35)";
      ctx.shadowBlur = 16;
      ctx.fillText(line, CX, y);
      ctx.shadowBlur = 0;
      y += lineHeight;
    }
    const afterQuote = 300 + lines.length * lineHeight + 20;

    // message number
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 34px ${MONO}`;
    ctx.fillText(`#${formatMessageNumber(messageNumber)}`, CX, afterQuote);

    // reactions
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 36px ${SANS}`;
    ctx.fillText(`🔥 ${formatCount(reactions)}`, CX, afterQuote + 66);

    // tagline
    ctx.fillStyle = "#6f6357";
    ctx.font = `400 24px ${SANS}`;
    ctx.letterSpacing = "12px";
    ctx.fillText("I WAS HERE.", CX, afterQuote + 128);
    ctx.letterSpacing = "0px";
  }, [content, messageNumber, reactions, wallDate, cardId]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl border border-edge shadow-2xl shadow-black/60"
    />
  );
}
