"use client";

import { useState, useSyncExternalStore } from "react";
import type { SharePayload } from "@/lib/share/copy";
import { redditShareUrl, telegramShareUrl, xShareUrl } from "@/lib/share/links";

type Props = {
  payload: SharePayload;
  via: "card" | "detail" | "publish" | "event";
  compact?: boolean;
  primaryLabel?: string;
};

function track(via: Props["via"], network: string) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "share", metadata: { via, network } }),
  });
}

export function SharePanel({ payload, via, compact = false, primaryLabel }: Props) {
  const [copied, setCopied] = useState<"idle" | "link" | "discord">("idle");
  const [native, setNative] = useState<"idle" | "shared">("idle");
  const canNative = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === "function",
    () => false,
  );

  const url =
    typeof window !== "undefined" ? `${window.location.origin}${payload.path}` : payload.url;

  async function copy(kind: "link" | "discord") {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      window.setTimeout(() => setCopied("idle"), 1600);
      track(via, kind === "discord" ? "discord" : "copy");
    } catch {
      setCopied("idle");
    }
  }

  async function shareNative() {
    try {
      if (navigator.share) {
        await navigator.share({ title: payload.title, text: payload.text, url });
        setNative("shared");
        track(via, "native");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    await copy("link");
  }

  const xHref = xShareUrl(payload.text, url);
  const telegramHref = telegramShareUrl(url, payload.text);
  const redditHref = redditShareUrl(url, payload.title);

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-3"}>
      {!compact ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => void shareNative()} className="btn btn-primary flex-1">
            {native === "shared"
              ? "Shared"
              : copied === "link" && !canNative
                ? "Link copied"
                : (primaryLabel ?? "Share")}
          </button>
          <button
            type="button"
            onClick={() => void copy("link")}
            className="btn btn-line flex-1"
          >
            {copied === "link" ? "Link copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void shareNative()} className="btn-ghost min-h-11 px-1 text-[0.65rem] tracking-[0.16em]">
          {copied === "link" ? "Copied" : native === "shared" ? "Shared" : "Share"}
        </button>
      )}
      {!compact ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          aria-label="Share on other networks"
        >
          <a href={xHref} target="_blank" rel="noopener noreferrer" className="btn-ghost kicker hover:text-paper" onClick={() => track(via, "x")}>
            Post on X
          </a>
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost kicker hover:text-paper"
            onClick={() => track(via, "telegram")}
          >
            Telegram
          </a>
          <a
            href={redditHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost kicker hover:text-paper"
            onClick={() => track(via, "reddit")}
          >
            Reddit
          </a>
          <button type="button" onClick={() => void copy("discord")} className="btn-ghost kicker hover:text-paper">
            {copied === "discord" ? "Copied for Discord" : "Discord"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
