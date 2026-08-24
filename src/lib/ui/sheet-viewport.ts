import { useEffect, useState } from "react";

export type SheetBox = {
  top: number;
  height: number;
};

function readSheetBox(): SheetBox | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 639px)").matches) {
    return null;
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { top: 0, height: Math.round(window.innerHeight) };
  }
  return {
    top: Math.round(vv.offsetTop),
    height: Math.max(240, Math.round(vv.height)),
  };
}

/** Keeps a bottom sheet inside the visible viewport while the mobile keyboard is open. */
export function useSheetBox(active: boolean): SheetBox | null {
  const [box, setBox] = useState<SheetBox | null>(null);

  useEffect(() => {
    if (!active) return;
    const sync = () => setBox(readSheetBox());
    const frame = window.requestAnimationFrame(sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [active]);

  return active ? box : null;
}
