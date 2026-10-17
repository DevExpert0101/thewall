import { DEFAULT_THEME, THEME_IDS, type ThemeId, themes } from "@/lib/design/tokens";

export const THEME_STORAGE_KEY = "thewall:theme";
export const THEME_COOKIE = "thewall-theme";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && (THEME_IDS as readonly string[]).includes(value));
}

export function parseTheme(value: string | null | undefined): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function readStoredTheme(): ThemeId | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  document.documentElement.setAttribute("data-scheme", themes[id].scheme);
  document.documentElement.style.colorScheme = themes[id].scheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // private browsing
  }
  document.cookie = `${THEME_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function resolveDocumentTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return parseTheme(document.documentElement.getAttribute("data-theme"));
}
