"use client";

import { useEffect, useId, useRef, useState } from "react";
import { applyTheme, parseTheme, resolveDocumentTheme } from "@/lib/design/theme";
import { DEFAULT_THEME, THEME_IDS, themes, type ThemeId } from "@/lib/design/tokens";

export function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    // document theme is applied by the boot script; read it after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from document
    setTheme(resolveDocumentTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: ThemeId) {
    applyTheme(id);
    setTheme(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="theme-switch">
      <button
        type="button"
        className="theme-switch-button"
        aria-label={`Theme: ${themes[theme].label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="theme-dot" style={{ background: "var(--bronze)" }} aria-hidden="true" />
        <span className="theme-dot" style={{ background: "var(--ember)" }} aria-hidden="true" />
      </button>
      {open ? (
        <div id={menuId} role="listbox" aria-label="Themes" className="theme-menu">
          {THEME_IDS.map((id) => {
            const option = themes[id];
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={theme === id}
                data-active={theme === id}
                className="theme-option"
                onClick={() => choose(id)}
              >
                <span className="flex shrink-0 gap-1" aria-hidden="true">
                  <span className="theme-dot" style={{ background: option.colors.void, boxShadow: `0 0 0 1px ${option.colors.bronze}` }} />
                  <span className="theme-dot" style={{ background: option.colors.bronze }} />
                  <span className="theme-dot" style={{ background: option.colors.ember }} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base leading-none text-paper">{option.label}</span>
                  <span className="mt-1 block text-[0.65rem] tracking-[0.12em] uppercase text-ash">
                    {option.line}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function useThemeScheme() {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const sync = () => {
      setScheme(themes[parseTheme(document.documentElement.getAttribute("data-theme"))].scheme);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return scheme;
}
