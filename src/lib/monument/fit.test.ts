import { describe, expect, it } from "vitest";
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "@/lib/monument/canvas";
import { CANVAS_FONT_PX, fitSentence, reconstructFittedText, wrapSentence } from "@/lib/monument/fit";

const box = { width: DEFAULT_CELL_WIDTH, height: DEFAULT_CELL_HEIGHT };

describe("Monument sentence fitting", () => {
  it("keeps the complete sentence and never truncates", () => {
    const text = "The future needs people willing to believe it deserves one.";
    const fitted = fitSentence(text, box);
    expect(reconstructFittedText(fitted.lines)).toBe(text);
    expect(fitted.fontSize).toBe(CANVAS_FONT_PX);
  });

  it("fits a 140-character sentence without clipping", () => {
    const text = "W".repeat(140);
    const fitted = fitSentence(text, box);
    expect(fitted.lines.join("")).toBe(text);
    const height = fitted.lines.length * fitted.fontSize * fitted.lineHeight;
    expect(height).toBeLessThanOrEqual(box.height);
  });

  it("uses the same wrap for the same sentence", () => {
    const text = "We were here, and we tried.";
    expect(wrapSentence(text, 16, 236)).toEqual(wrapSentence(text, 16, 236));
    expect(fitSentence(text, box)).toEqual(fitSentence(text, box));
  });

  it("breaks a long word instead of overflowing", () => {
    const text = "A".repeat(80);
    const lines = wrapSentence(text, 16, 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
  });

  it("keeps Unicode and emoji in the sentence", () => {
    const text = "也许善意才是全部意义。🔥 We were here.";
    const fitted = fitSentence(text, box);
    expect(reconstructFittedText(fitted.lines)).toBe(text);
    expect(fitted.fontSize).toBe(CANVAS_FONT_PX);
  });
});
