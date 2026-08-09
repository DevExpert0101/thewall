"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";

interface ShareButtonsProps {
  /** Absolute deep link to the message, e.g. "https://…/?v=42913". */
  url: string;
  title: string;
  text: string;
  /** When omitted, the "Download image" button is hidden. */
  onDownload?: () => void;
}

const intent =
  "rounded-full border border-edge px-4 py-2 text-xs font-medium text-muted transition hover:border-ember hover:bg-ember/10 hover:text-gold";

export default function ShareButtons({
  url,
  title,
  text,
  onDownload,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    track("message_shared");
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    track("message_shared");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // dismissed or unsupported — fall through to copy
      }
    }
    await copy();
  };

  const enc = encodeURIComponent;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={nativeShare}
        className="rounded-full bg-gradient-to-r from-flame to-ember px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
      >
        Share
      </button>
      <button
        onClick={copy}
        className={`${intent} ${copied ? "border-gold/60 text-gold" : ""}`}
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={intent}
      >
        X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={intent}
      >
        Facebook
      </a>
      <a
        href={`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={intent}
      >
        Reddit
      </a>
      <a
        href={`https://wa.me/?text=${enc(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={intent}
      >
        WhatsApp
      </a>
      {onDownload && (
        <button onClick={onDownload} className={intent}>
          Download image
        </button>
      )}
    </div>
  );
}
