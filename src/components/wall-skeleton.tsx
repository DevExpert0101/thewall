export function WallSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="wall-columns" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="inscribe wall-card p-4 sm:p-5">
          <div className="h-2.5 w-16 wall-shimmer" />
          <div className="mt-5 h-6 w-full wall-shimmer" />
          <div className="mt-2 h-6 w-[78%] wall-shimmer opacity-70" />
          <div className="mt-2 h-6 w-[42%] wall-shimmer opacity-40" />
          <div className="mt-6 h-px w-full bg-line" />
          <div className="mt-3 h-3 w-12 wall-shimmer" />
        </div>
      ))}
    </div>
  );
}
