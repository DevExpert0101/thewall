"use client";

import { useCallback, useEffect, useRef } from "react";

const INTRO_FALLBACK_MS = 16_000;

export function HeroIntroFilm({ onDone }: { onDone: () => void }) {
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }
    const id = window.setTimeout(finish, INTRO_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [finish]);

  return (
    <video
      className="hero-intro"
      autoPlay
      muted
      playsInline
      disablePictureInPicture
      poster="/hero-wall.png"
      onEnded={finish}
      onError={finish}
    >
      <source src="/hero-wall.mp4" type="video/mp4" />
    </video>
  );
}
