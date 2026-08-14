"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        source: "the-wall-client",
        digest: error.digest ?? "unknown",
      }),
    );
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-4 py-24 text-center">
      <p className="kicker">Unavailable</p>
      <h1 className="mt-5 font-display text-[clamp(2.2rem,7vw,3.6rem)] leading-[0.95] text-paper">
        The Wall could not be loaded.
      </h1>
      <p className="lede mt-5">
        Try again in a moment. Nothing on this page exposes internal details.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mx-auto mt-10">
        Try again
      </button>
    </main>
  );
}
