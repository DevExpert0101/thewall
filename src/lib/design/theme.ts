import { DEFAULT_THEME, LIGHT_THEME_IDS, THEME_IDS, type ThemeId, themes } from "@/lib/design/tokens";

export const THEME_STORAGE_KEY = "thewall:theme";

export const THEME_BOOT_SCRIPT = `(function(){try{var a=${JSON.stringify(THEME_IDS)};var l=${JSON.stringify(LIGHT_THEME_IDS)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t&&a.indexOf(t)!==-1){var s=l.indexOf(t)!==-1?"light":"dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-scheme",s);document.documentElement.style.colorScheme=s;}}catch(e){}})();`;

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
}

export function resolveDocumentTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return parseTheme(document.documentElement.getAttribute("data-theme"));
}
