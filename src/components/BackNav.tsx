"use client";

import { useRouter } from "next/navigation";

export default function BackNav() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={goBack}
      className="sticky top-4 z-10 self-start rounded-full border border-edge bg-surface/80 px-4 py-2 text-xs uppercase tracking-widest text-muted backdrop-blur-sm transition hover:border-ember hover:text-gold glow-ember"
    >
      ← Back
    </button>
  );
}
