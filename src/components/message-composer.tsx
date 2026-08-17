"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MESSAGE_MAX_GRAPHEMES } from "@/lib/constants";
import { graphemeCount } from "@/lib/message/normalize";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onContinue?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function MessageComposer({
  id = "wall-message",
  value,
  onChange,
  onContinue,
  disabled = false,
  autoFocus = false,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const count = useMemo(() => graphemeCount(value), [value]);
  const remaining = MESSAGE_MAX_GRAPHEMES - count;
  const over = remaining < 0;

  function fit() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const compact =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches;
    const next = Math.min(Math.max(el.scrollHeight, compact ? 88 : 120), compact ? 132 : 280);
    el.style.height = `${next}px`;
  }

  useLayoutEffect(() => {
    fit();
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    areaRef.current?.focus();
  }, [autoFocus]);

  return (
    <div>
      <label className="kicker block" htmlFor={id}>
        Your sentence
      </label>
      <textarea
        ref={areaRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={fit}
        onFocus={() => {
          areaRef.current?.scrollIntoView?.({ block: "center", inline: "nearest" });
        }}
        disabled={disabled}
        rows={3}
        enterKeyHint="enter"
        inputMode="text"
        autoCapitalize="sentences"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        aria-describedby={`${id}-count`}
        aria-invalid={over}
        placeholder="One sentence. No name."
        className={cn(
          "composer-field mt-3 max-h-[280px] min-h-[120px] w-full resize-none overflow-y-auto border bg-void/70 px-3.5 py-3 font-display text-lg leading-snug text-paper placeholder:text-ash/55 transition-[border-color] duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze sm:text-2xl",
          over ? "border-blood" : "border-line focus:border-bronze",
        )}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!disabled && !over && value.trim()) onContinue?.();
          }
        }}
      />
      <p
        id={`${id}-count`}
        className={cn(
          "mt-2 font-mono text-xs tabular",
          over ? "text-blood" : remaining <= 20 ? "text-ember" : "text-ash",
        )}
        aria-live={over ? "assertive" : "off"}
      >
        {count} / {MESSAGE_MAX_GRAPHEMES}
        <span className="sr-only">
          {over
            ? `Over by ${-remaining} characters`
            : `${remaining} characters remaining`}
        </span>
      </p>
      <p className="mt-1 text-[11px] text-ash">Return for a new line. Ctrl or ⌘ Enter to continue.</p>
    </div>
  );
}

export function composerCanContinue(text: string): boolean {
  const count = graphemeCount(text);
  return Boolean(text.trim()) && count > 0 && count <= MESSAGE_MAX_GRAPHEMES;
}
