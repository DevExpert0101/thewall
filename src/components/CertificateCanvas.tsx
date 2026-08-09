"use client";

import { useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { downloadCanvas, MONO, SANS, wrapText } from "@/lib/canvas";
import { formatDate, ordinal } from "@/lib/wall";

interface CertificateCanvasProps {
  content: string;
  messageNumber: number;
  /** Final reaction count. */
  reactions: number;
  /** Performance rank (by reactions) — dynamic until the wall freezes. */
  rank: number;
  /** Whether the wall has frozen — the rank is only final once it has. */
  frozen: boolean;
  /** Event date (wall created_at) — printed as AUGUST 9, 2026. */
  eventDate: string;
  /** Total number of voices on the wall. */
  total: number;
  /** Unique certificate ID. */
  certificateId: string;
  /** URL encoded in the QR code — links to the archived message. */
  qrUrl: string;
}

const W = 1600;
const H = 1120;
const DISPLAY = '"Instrument Serif", Georgia, "Times New Roman", serif';
const QR_SIZE = 190;

export default function CertificateCanvas({
  content,
  messageNumber,
  reactions,
  rank,
  frozen,
  eventDate,
  total,
  certificateId,
  qrUrl,
}: CertificateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

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
    ctx.fillStyle = "#070505";
    ctx.fillRect(0, 0, W, H);

    // soft ember glow behind the title
    const glow = ctx.createRadialGradient(W / 2, 200, 60, W / 2, 200, 620);
    glow.addColorStop(0, "rgba(255,122,26,0.22)");
    glow.addColorStop(1, "rgba(255,122,26,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // engraved double border
    ctx.strokeStyle = "#2a2016";
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    const grad = ctx.createLinearGradient(40, 40, W - 40, H - 40);
    grad.addColorStop(0, "rgba(255,122,26,0.55)");
    grad.addColorStop(0.5, "rgba(255,178,102,0.25)");
    grad.addColorStop(1, "rgba(255,122,26,0.55)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.strokeRect(56, 56, W - 112, H - 112);

    // corner ticks
    ctx.fillStyle = "#ff9a3d";
    for (const [x, y, dx, dy] of [
      [56, 56, 1, 1],
      [W - 56, 56, -1, 1],
      [56, H - 56, 1, -1],
      [W - 56, H - 56, -1, -1],
    ]) {
      ctx.fillRect(x + 6 * dx, y - 3, 48 * dx, 6);
      ctx.fillRect(x - 3, y + 6 * dy, 6, 48 * dy);
    }

    ctx.textAlign = "center";

    // THE WALL
    const titleGrad = ctx.createLinearGradient(W / 2 - 420, 0, W / 2 + 420, 0);
    titleGrad.addColorStop(0, "#ffd28a");
    titleGrad.addColorStop(0.35, "#fff3e0");
    titleGrad.addColorStop(0.65, "#ff9a3d");
    titleGrad.addColorStop(1, "#ff7a1a");
    ctx.fillStyle = titleGrad;
    ctx.font = `400 104px ${DISPLAY}`;
    ctx.fillText("THE WALL", W / 2, 252);

    // event date
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 28px ${MONO}`;
    ctx.fillText(formatDate(eventDate).toUpperCase(), W / 2, 320);

    // message number
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 34px ${MONO}`;
    ctx.fillText(
      `#${messageNumber.toLocaleString("en-US")}`,
      W / 2,
      388,
    );

    // the message itself — the whole stack is vertically balanced so short
    // quotes sit as comfortably as five-line ones.
    const msgGrad = ctx.createLinearGradient(0, 420, 0, 720);
    msgGrad.addColorStop(0, "#fff6ea");
    msgGrad.addColorStop(1, "#e8d9c0");
    ctx.fillStyle = msgGrad;
    ctx.font = `italic 46px ${DISPLAY}`;
    const lines = wrapText(ctx, content, 1180, 5);
    const lineHeight = 60;
    // Fixed spacing below the quote keeps the block readable at any length.
    const stackTop = Math.max(
      430,
      900 - (lines.length * lineHeight + 40 + 60 + 60 + 50 + 50),
    );
    let y = stackTop;
    for (const line of lines) {
      ctx.shadowColor = "rgba(255,122,26,0.35)";
      ctx.shadowBlur = 18;
      ctx.fillText(line, W / 2, y);
      ctx.shadowBlur = 0;
      y += lineHeight;
    }

    // MESSAGE # — the permanent place in history (when it entered the Wall).
    ctx.fillStyle = "#6f6357";
    ctx.font = `400 26px ${MONO}`;
    ctx.fillText(
      `MESSAGE #${messageNumber.toLocaleString("en-US")}`,
      W / 2,
      y + 40,
    );

    // FINAL RANK — performance, dynamic until the Wall freezes.
    const rankGrad = ctx.createLinearGradient(0, 0, 0, 60);
    rankGrad.addColorStop(0, "#fff3e0");
    rankGrad.addColorStop(1, "#ff7a1a");
    ctx.fillStyle = rankGrad;
    ctx.shadowColor = "rgba(255,122,26,0.6)";
    ctx.shadowBlur = 30;
    ctx.font = `400 48px ${MONO}`;
    ctx.fillText(
      `${frozen ? "FINAL RANK" : "RANK"} #${rank.toLocaleString("en-US")}`,
      W / 2,
      y + 100,
    );
    ctx.shadowBlur = 0;

    // final reaction count
    ctx.fillStyle = "#ffd28a";
    ctx.font = `400 38px ${SANS}`;
    ctx.fillText(`🔥 ${reactions.toLocaleString("en-US")}`, W / 2, y + 160);

    // place among all voices
    ctx.fillStyle = "#6f6357";
    ctx.font = `400 22px ${MONO}`;
    ctx.fillText(
      `${ordinal(messageNumber)} voice of ${total.toLocaleString("en-US")} voices`,
      W / 2,
      y + 210,
    );

    // YOU WERE HERE.
    ctx.fillStyle = "#ff9a3d";
    ctx.font = `400 26px ${SANS}`;
    ctx.letterSpacing = "10px";
    ctx.fillText("YOU WERE HERE.", W / 2, y + 260);
    ctx.letterSpacing = "0px";

    // footer
    ctx.fillStyle = "#6f6357";
    ctx.font = `400 44px ${DISPLAY}`;
    ctx.fillText("THE WALL", W / 2, H - 88);

    // unique certificate ID
    ctx.fillStyle = "#4a4136";
    ctx.font = `400 20px ${MONO}`;
    ctx.fillText(`CERTIFICATE ${certificateId}`, W / 2, H - 48);

    // QR code — bottom right, crisp at device-pixel ratio.
    const qx = W - 56 - QR_SIZE - 30;
    const qy = H - 56 - QR_SIZE - 30;
    ctx.fillStyle = "#0d0a07";
    ctx.fillRect(qx - 10, qy - 34, QR_SIZE + 20, QR_SIZE + 44);
    ctx.strokeStyle = "rgba(255,122,26,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(qx - 10, qy - 34, QR_SIZE + 20, QR_SIZE + 44);
    ctx.fillStyle = "#4a4136";
    ctx.font = `400 17px ${MONO}`;
    ctx.fillText("SCAN · VERIFY · FOREVER", qx + QR_SIZE / 2, qy - 14);
    const qr = qrRef.current;
    if (qr) ctx.drawImage(qr, qx, qy, QR_SIZE, QR_SIZE);
  }, [content, messageNumber, reactions, rank, frozen, eventDate, total, certificateId, qrUrl]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        className="rounded-xl border border-edge shadow-2xl shadow-black/60"
      />
      <button
        onClick={() => {
          const canvas = canvasRef.current;
          if (canvas) downloadCanvas(canvas, `wall-certificate-${certificateId}.png`);
        }}
        className="rounded-full bg-gradient-to-r from-flame to-ember px-7 py-3 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
      >
        Download certificate (PNG)
      </button>
      {/* Off-screen QR source — drawn into the certificate at its native
          resolution so it stays sharp when scaled by devicePixelRatio. */}
      <div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0">
        <QRCodeCanvas
          ref={qrRef}
          value={qrUrl}
          size={QR_SIZE}
          level="M"
          marginSize={4}
        />
      </div>
    </div>
  );
}
