export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-busy="true" aria-live="polite">
      <p className="kicker">The monument is assembling</p>
      <div className="mt-8 h-16 w-2/3 max-w-md wall-shimmer" />
      <div className="mt-6 h-4 w-full max-w-xl wall-shimmer opacity-70" />
      <div className="mt-3 h-4 w-5/6 max-w-lg wall-shimmer opacity-50" />
      <div className="mt-16 grid gap-3 md:grid-cols-2">
        <div className="inscribe h-36 wall-shimmer" />
        <div className="inscribe h-36 wall-shimmer opacity-80" />
      </div>
    </main>
  );
}
