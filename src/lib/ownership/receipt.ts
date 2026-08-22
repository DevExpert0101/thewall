import { BRAND } from "@/lib/brand";
import { formatWallKey } from "@/lib/ownership/wall-key";
import { formatPublicNumber } from "@/lib/utils";

export function privateReceiptText(input: {
  wallKey: string;
  publicNumber?: number;
  text?: string;
  publishedAt?: string;
}): string {
  const key = formatWallKey(input.wallKey);
  const number = input.publicNumber ? formatPublicNumber(input.publicNumber) : null;
  const lines = [
    BRAND.wordmark,
    BRAND.ownershipReceiptMark,
    "",
    "Contains Wall Key.",
    "Never share.",
    "",
    BRAND.wallKeyYours,
    key,
    "",
    number
      ? `This private key proves that Message ${number} is yours.`
      : "This private key will prove the sentence is yours after it is published.",
    "Keep it somewhere safe.",
    "We cannot recover it.",
  ];
  if (number) {
    lines.push("", `MESSAGE ${number}`);
  }
  if (input.text) {
    lines.push(`“${input.text}”`);
  }
  if (input.publishedAt) {
    lines.push(new Date(input.publishedAt).toISOString().replace(".000Z", " UTC"));
  }
  lines.push(
    "",
    `This is not the ${BRAND.certificate}.`,
    `The ${BRAND.certificate} is safe to share. This file is not.`,
  );
  return `${lines.join("\n")}\n`;
}

export function downloadPrivateReceipt(input: {
  wallKey: string;
  publicNumber?: number;
  text?: string;
  publishedAt?: string;
}) {
  if (typeof document === "undefined") return;
  const body = privateReceiptText(input);
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = input.publicNumber
    ? `the-wall-ownership-receipt-${input.publicNumber}.txt`
    : "the-wall-ownership-receipt.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

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
  const number = input.publicNumber ? formatPublicNumber(input.publicNumber) : null;
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
  ctx.fillText(BRAND.wordmark, 600, 168);
  ctx.fillText(BRAND.ownershipReceiptMark, 600, 208);

  ctx.fillStyle = "#9b9285";
  ctx.font = "20px ui-sans-serif, sans-serif";
  ctx.fillText(BRAND.wallKeyContains, 600, 258);

  ctx.fillStyle = "#f6f1e7";
  ctx.font = "44px Georgia, serif";
  ctx.fillText(BRAND.wallKeyYours, 600, 340);

  ctx.fillStyle = "rgba(198, 163, 108, 0.28)";
  ctx.strokeStyle = "rgba(198, 163, 108, 0.55)";
  ctx.lineWidth = 2;
  ctx.fillRect(140, 380, 920, 200);
  ctx.strokeRect(140, 380, 920, 200);

  const groups = key.split("-");
  const keyLines =
    groups.length >= 4
      ? [groups.slice(0, 2).join("-"), groups.slice(2).join("-")]
      : [key];
  ctx.fillStyle = "#c6a36c";
  ctx.font = `${fitMonoSize(ctx, keyLines, 840, 56)}px ui-monospace, monospace`;
  keyLines.forEach((line, index) => {
    ctx.fillText(line, 600, 460 + index * 72);
  });

  ctx.fillStyle = "#d8d0c4";
  ctx.font = "24px ui-sans-serif, sans-serif";
  const proof = number
    ? `This private key proves that Message ${number} is yours.`
    : "This private key will prove the sentence is yours.";
  wrapText(ctx, proof, 600, 640, 880, 34);
  ctx.fillText("Keep it somewhere safe.", 600, 720);
  ctx.fillText("We cannot recover it.", 600, 760);

  let cursor = 860;
  if (number) {
    ctx.fillStyle = "#d8d0c4";
    ctx.font = "28px ui-monospace, monospace";
    ctx.fillText(`MESSAGE ${number}`, 600, cursor);
    cursor += 56;
  }

  if (input.text) {
    ctx.fillStyle = "#f6f1e7";
    ctx.font = "30px Georgia, serif";
    cursor = wrapText(ctx, `“${input.text}”`, 600, cursor, 880, 40) + 48;
  }

  if (input.publishedAt) {
    ctx.fillStyle = "#9b9285";
    ctx.font = "22px ui-monospace, monospace";
    ctx.fillText(new Date(input.publishedAt).toISOString().replace(".000Z", " UTC"), 600, cursor);
  }

  ctx.fillStyle = "#9b9285";
  ctx.font = "20px ui-sans-serif, sans-serif";
  ctx.fillText(`This is not the ${BRAND.certificate}.`, 600, 1360);
  ctx.fillText(`The ${BRAND.certificate} is safe to share. This card is not.`, 600, 1400);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = input.publicNumber
    ? `the-wall-ownership-receipt-${input.publicNumber}.png`
    : "the-wall-ownership-receipt.png";
  link.click();
}

function fitMonoSize(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  start: number,
) {
  let size = start;
  while (size > 28) {
    ctx.font = `${size}px ui-monospace, monospace`;
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) return size;
    size -= 2;
  }
  return size;
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
  return row;
}
