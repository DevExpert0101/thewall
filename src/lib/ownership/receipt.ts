import { formatWallKey } from "@/lib/ownership/wall-key";
import { formatPublicNumber } from "@/lib/utils";

export function downloadOwnershipCard(input: {
  wallKey: string;
  publicNumber?: number;
  text?: string;
  publishedAt?: string;
}) {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const key = formatWallKey(input.wallKey);
  ctx.fillStyle = "#080706";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(600, 220, 40, 600, 280, 520);
  glow.addColorStop(0, "rgba(200, 92, 42, 0.22)");
  glow.addColorStop(1, "rgba(8, 7, 6, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(198, 163, 108, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, canvas.width - 128, canvas.height - 128);

  ctx.fillStyle = "#c6a36c";
  ctx.font = "22px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("THE WALL", 600, 180);
  ctx.fillText("PRIVATE OWNERSHIP CARD", 600, 230);

  ctx.fillStyle = "#f6f1e7";
  ctx.font = "48px Georgia, serif";
  ctx.fillText("YOUR WALL KEY", 600, 420);

  ctx.fillStyle = "#c6a36c";
  ctx.font = "54px ui-monospace, monospace";
  ctx.fillText(key, 600, 530);

  if (input.publicNumber) {
    ctx.fillStyle = "#d8d0c4";
    ctx.font = "28px ui-monospace, monospace";
    ctx.fillText(`MESSAGE ${formatPublicNumber(input.publicNumber)}`, 600, 640);
  }

  if (input.text) {
    ctx.fillStyle = "#f6f1e7";
    ctx.font = "32px Georgia, serif";
    const quote = `“${input.text}”`;
    wrapText(ctx, quote, 600, 740, 880, 42);
  }

  if (input.publishedAt) {
    ctx.fillStyle = "#9b9285";
    ctx.font = "22px ui-monospace, monospace";
    ctx.fillText(new Date(input.publishedAt).toISOString().replace(".000Z", " UTC"), 600, 1180);
  }

  ctx.fillStyle = "#9b9285";
  ctx.font = "20px ui-sans-serif, sans-serif";
  ctx.fillText("This key proves control of the sentence.", 600, 1320);
  ctx.fillText("Keep private. We cannot recover it.", 600, 1360);
  ctx.fillText("The paying wallet is not your identity.", 600, 1400);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = input.publicNumber
    ? `the-wall-key-${input.publicNumber}.png`
    : "the-wall-key.png";
  link.click();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let row = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, row);
      line = word;
      row += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, row);
}
