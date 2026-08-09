import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
        This page is not on the wall
      </p>
      <h1 className="text-shimmer font-display text-6xl leading-none sm:text-8xl">
        404
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        The message behind this link no longer exists — or it never did. Sealed
        walls live on as permanent records, but their messages only remain
        reachable while the wall itself endures.
      </p>
      <Link
        href="/"
        className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
      >
        Back to the current Wall
      </Link>
    </main>
  );
}
