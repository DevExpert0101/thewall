"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readStoredTheme } from "@/lib/design/theme";

/** Applies a stored theme before paint when the request had no theme cookie yet. */
export function ThemeBoot() {
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (!stored || stored === document.documentElement.getAttribute("data-theme")) return;
    applyTheme(stored);
  }, []);
  return null;
}
