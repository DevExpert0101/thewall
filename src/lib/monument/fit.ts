import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";

export const CANVAS_FONT_PX = 15;
export const CANVAS_MIN_FONT_PX = CANVAS_FONT_PX;
export const CANVAS_MAX_FONT_PX = CANVAS_FONT_PX;
export const CANVAS_LINE_HEIGHT = 1.35;
export const CANVAS_PAD_X = 12;
export const CANVAS_PAD_Y = 10;

export type FittedSentence = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

function graphemesOf(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
      (part) => part.segment,
    );
  }
  return [...text];
}

function isWideGlyph(glyph: string): boolean {
  const code = glyph.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0x20000 && code <= 0x2fa1f)
  );
}

function glyphWidth(glyph: string, fontSize: number): number {
  if (!glyph || /\p{M}/u.test(glyph)) return 0;
  if (/\p{Extended_Pictographic}/u.test(glyph)) return fontSize * 1.12;
  if (/\s/u.test(glyph)) return fontSize * 0.32;
  if (isWideGlyph(glyph)) return fontSize;
  return fontSize * 0.58;
}

function tokenWidth(token: string, fontSize: number): number {
  return graphemesOf(token).reduce((sum, glyph) => sum + glyphWidth(glyph, fontSize), 0);
}

function wrapLine(token: string, fontSize: number, maxWidth: number): string[] {
  if (tokenWidth(token, fontSize) <= maxWidth) return [token];
  const glyphs = graphemesOf(token);
  const lines: string[] = [];
  let current = "";
  for (const glyph of glyphs) {
    const next = current + glyph;
    if (current && tokenWidth(next, fontSize) > maxWidth) {
      lines.push(current);
      current = glyph;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapSentence(text: string, fontSize: number, maxWidth: number): string[] {
  const tokens = text.split(/(\s+)/).filter((part) => part.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current) current += token;
      continue;
    }
    const pieces = wrapLine(token, fontSize, maxWidth);
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i] ?? "";
      const candidate = current ? `${current}${piece}` : piece;
      if (current && tokenWidth(candidate, fontSize) > maxWidth) {
        lines.push(current.trimEnd());
        current = piece;
      } else if (i > 0 && current) {
        lines.push(current.trimEnd());
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current.trim().length > 0) lines.push(current.trimEnd());
  return lines.length > 0 ? lines : [""];
}

export function fitSentence(
  text: string,
  box: { width: number; height: number },
): FittedSentence {
  const innerWidth = Math.max(1, box.width - CANVAS_PAD_X * 2);
  const fontSize = CANVAS_FONT_PX;
  const lines = wrapSentence(text, fontSize, innerWidth);
  return { fontSize, lineHeight: CANVAS_LINE_HEIGHT, lines };
}

export function reconstructFittedText(lines: string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

export function worstCaseSentence(length = MESSAGE_MAX_GRAPHEMES): string {
  return "W".repeat(length);
}
