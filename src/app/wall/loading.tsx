import { WallSkeleton } from "@/components/wall-skeleton";

export default function WallLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <p className="kicker">The Wall</p>
      <div className="mt-6 h-10 w-56 wall-shimmer" />
      <div className="mt-8">
        <WallSkeleton />
      </div>
    </main>
  );
}
