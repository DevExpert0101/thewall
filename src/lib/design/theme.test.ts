import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, isThemeId, parseTheme, readStoredTheme, THEME_STORAGE_KEY } from "@/lib/design/theme";
import { DEFAULT_THEME, THEME_IDS, themes } from "@/lib/design/tokens";

afterEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute("data-theme");
});

describe("themes", () => {
  it("ships five named monument palettes", () => {
    expect(THEME_IDS).toEqual(["limestone", "obsidian", "patina", "midnight", "marble"]);
    expect(themes.limestone.scheme).toBe("dark");
    expect(themes.marble.scheme).toBe("light");
  });

  it("rejects unknown theme ids and keeps limestone as default", () => {
    expect(isThemeId("limestone")).toBe(true);
    expect(isThemeId("neon")).toBe(false);
    expect(parseTheme("neon")).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
  });

  it("applies a theme to the document and remembers it", () => {
    applyTheme("obsidian");
    expect(document.documentElement.getAttribute("data-theme")).toBe("obsidian");
    expect(readStoredTheme()).toBe("obsidian");
  });
});
