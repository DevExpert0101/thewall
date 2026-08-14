"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        source: "the-wall-global",
        digest: error.digest ?? "unknown",
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Unavailable</p>
          <h1 className="mt-5 text-4xl">The Wall could not be loaded.</h1>
          <p className="mt-5 text-neutral-300">
            Try again in a moment. Nothing on this page exposes internal details.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mx-auto mt-10 border border-white px-5 py-3"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
