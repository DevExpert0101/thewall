import { LIVE_FONT_MAX_PX, LIVE_FONT_MIN_PX } from "@/lib/wall/constants";
import type { PublicMessage } from "@/lib/types";

export const LIVE_LAYOUT_GAP = 14;
export const LIVE_LAYOUT_PAD = 8;
export const LIVE_FIRE_RESERVE = 22;
export const LIVE_LINE_HEIGHT = 1.3;
export const LIVE_CHAR_WIDTH = 0.56;
export const LIVE_FALLBACK_CANVAS = { width: 1200, height: 720 };

export type LiveLayoutItem = {
  id: string;
  publicNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  maxCh: number;
};

export function liveFontPx(
  reactions: number,
  maxReactions: number,
  sentenceCount: number,
): number {
  const crowd = Math.min(1, Math.sqrt(20 / Math.max(sentenceCount, 1)));
  const scale = Math.max(0.4, crowd);
  const weight = Math.log1p(Math.max(0, reactions));
  const top = Math.log1p(Math.max(1, maxReactions));
  const t = weight / top;
  return Math.max(
    LIVE_FONT_MIN_PX,
    (LIVE_FONT_MIN_PX + t * (LIVE_FONT_MAX_PX - LIVE_FONT_MIN_PX)) * scale,
  );
}

export function liveMaxCh(text: string): number {
  const n = [...text].length;
  return Math.min(36, Math.max(12, Math.ceil(n * 0.55)));
}

export function estimateSentenceBox(
  text: string,
  fontSize: number,
): { width: number; height: number } {
  const maxCh = liveMaxCh(text);
  const glyphs = Math.max(1, [...text].length);
  const innerMax = maxCh * fontSize * LIVE_CHAR_WIDTH;
  const natural = glyphs * fontSize * LIVE_CHAR_WIDTH;
  const inner = Math.min(innerMax, natural);
  const width = inner + LIVE_LAYOUT_PAD * 2;
  const lines = Math.max(1, Math.ceil(natural / Math.max(1, inner)));
  const height = lines * fontSize * LIVE_LINE_HEIGHT + LIVE_FIRE_RESERVE + LIVE_LAYOUT_PAD;
  return { width, height };
}

function packRow(
  messages: PublicMessage[],
  canvas: { width: number; height: number },
  maxReactions: number,
  fontScale: number,
): LiveLayoutItem[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let rowIndex = 0;
  const items: LiveLayoutItem[] = [];

  for (const message of messages) {
    const fontSize = Math.max(LIVE_FONT_MIN_PX, liveFontPx(message.reactionCount, maxReactions, messages.length) * fontScale);
    const maxCh = liveMaxCh(message.text);
    const box = estimateSentenceBox(message.text, fontSize);
    const width = Math.min(box.width, canvas.width);
    const height = box.height;
    if (x > 0 && x + width > canvas.width) {
      x = 0;
      y += rowHeight + LIVE_LAYOUT_GAP;
      rowHeight = 0;
      rowIndex += 1;
    }
    if (x === 0 && rowIndex % 2 === 1) {
      const indent = Math.min(32, canvas.width * 0.06);
      if (indent + width <= canvas.width) x = indent;
    }
    items.push({
      id: message.id,
      publicNumber: message.publicNumber,
      x,
      y,
      width,
      height,
      fontSize,
      maxCh,
    });
    x += width + LIVE_LAYOUT_GAP;
    rowHeight = Math.max(rowHeight, height);
  }
  return items;
}

export function layoutLiveWall(
  messages: PublicMessage[],
  canvas: { width: number; height: number } = LIVE_FALLBACK_CANVAS,
): LiveLayoutItem[] {
  if (messages.length === 0 || canvas.width < 1 || canvas.height < 1) return [];
  const ordered = [...messages].sort((a, b) => a.publicNumber - b.publicNumber);
  const maxReactions = ordered.reduce((max, message) => Math.max(max, message.reactionCount), 0);
  let fontScale = 1;
  let items = packRow(ordered, canvas, maxReactions, fontScale);
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const bottom = items.reduce((max, item) => Math.max(max, item.y + item.height), 0);
    const right = items.reduce((max, item) => Math.max(max, item.x + item.width), 0);
    if (bottom <= canvas.height && right <= canvas.width) return items;
    fontScale *= 0.84;
    items = packRow(ordered, canvas, maxReactions, fontScale);
  }
  return items;
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
