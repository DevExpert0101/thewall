import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, isThemeId, parseTheme, readStoredTheme, THEME_STORAGE_KEY } from "@/lib/design/theme";
import { DEFAULT_THEME, THEME_IDS, themes } from "@/lib/design/tokens";

afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-scheme");
});

describe("themes", () => {
  it("ships five named design systems", () => {
    expect(THEME_IDS).toEqual(["carbon", "navy", "atelier", "paper", "swiss"]);
    expect(themes.carbon.scheme).toBe("dark");
    expect(themes.paper.scheme).toBe("light");
    expect(themes.swiss.scheme).toBe("light");
  });

  it("rejects unknown theme ids and keeps carbon as default", () => {
    expect(isThemeId("carbon")).toBe(true);
    expect(isThemeId("limestone")).toBe(false);
    expect(isThemeId("neon")).toBe(false);
    expect(parseTheme("neon")).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
  });

  it("applies a theme to the document and remembers it", () => {
    applyTheme("navy");
    expect(document.documentElement.getAttribute("data-theme")).toBe("navy");
    expect(document.documentElement.getAttribute("data-scheme")).toBe("dark");
    expect(readStoredTheme()).toBe("navy");
  });
});
