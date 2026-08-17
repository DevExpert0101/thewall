"use client";

import { useState, useSyncExternalStore } from "react";
import type { SharePayload } from "@/lib/share/copy";
import { creativeImageUrl, messageNumberFromSharePath, redditShareUrl, telegramShareUrl, xShareUrl } from "@/lib/share/links";

type Props = {
  payload: SharePayload;
  via: "card" | "detail" | "publish" | "event" | "random" | "milestone";
  compact?: boolean;
  primaryLabel?: string;
  preview?: boolean;
  cards?: boolean;
};

function track(via: Props["via"], network: string) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "share", metadata: { via, network } }),
  });
}

export function SharePanel({
  payload,
  via,
  compact = false,
  primaryLabel,
  preview = false,
  cards = true,
}: Props) {
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
  const publicNumber = messageNumberFromSharePath(payload.path);

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-3"}>
      {preview && !compact ? (
        <figure className="share-artifact">
          {publicNumber ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creativeImageUrl({ kind: "message", ratio: "1200x630", number: publicNumber })}
              alt=""
              className="share-artifact-image"
            />
          ) : null}
          <blockquote className="share-artifact-text">
            <p className="whitespace-pre-line text-sm leading-relaxed text-paper">{payload.text}</p>
          </blockquote>
        </figure>
      ) : null}
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
      <p className="sr-only" aria-live="polite">
        {copied === "link" ? "Link copied" : copied === "discord" ? "Copied for Discord" : native === "shared" ? "Shared" : ""}
      </p>
      {!compact ? (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          role="group"
          aria-label="Share on other networks"
        >
          <a href={xHref} target="_blank" rel="noopener noreferrer" className="btn-ghost min-h-11 kicker hover:text-paper" onClick={() => track(via, "x")}>
            Post on X
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost min-h-11 kicker hover:text-paper"
            onClick={() => track(via, "telegram")}
          >
            Telegram
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href={redditHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost min-h-11 kicker hover:text-paper"
            onClick={() => track(via, "reddit")}
          >
            Reddit
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" onClick={() => void copy("discord")} className="btn-ghost min-h-11 kicker hover:text-paper">
            {copied === "discord" ? "Copied for Discord" : "Discord"}
          </button>
        </div>
      ) : null}
      {cards && publicNumber && !compact ? (
        <div className="mt-1 text-left">
          <p className="kicker text-bronze">This sentence as an image</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={creativeImageUrl({ kind: "message", ratio: "1200x630", number: publicNumber })}
              className="btn-ghost min-h-11 kicker hover:text-paper"
              rel="nofollow"
              download={`the-wall-${publicNumber}-1200x630.png`}
              aria-label="1200×630 landscape card"
              onClick={() => track(via, "card-1200x630")}
            >
              1200×630
            </a>
            <a
              href={creativeImageUrl({ kind: "message", ratio: "1:1", number: publicNumber })}
              className="btn-ghost min-h-11 kicker hover:text-paper"
              rel="nofollow"
              download={`the-wall-${publicNumber}-square.png`}
              aria-label="Square card"
              onClick={() => track(via, "card-square")}
            >
              Square
            </a>
            <a
              href={creativeImageUrl({ kind: "message", ratio: "9:16", number: publicNumber })}
              className="btn-ghost min-h-11 kicker hover:text-paper"
              rel="nofollow"
              download={`the-wall-${publicNumber}-portrait.png`}
              aria-label="Portrait card"
              onClick={() => track(via, "card-portrait")}
            >
              Portrait
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
