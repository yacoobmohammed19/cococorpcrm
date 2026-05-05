export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "var(--card3)", ...style }}
    />
  );
}

export function SkeletonPage({ cards = 4, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className={`grid grid-cols-2 md:grid-cols-${cards} gap-3`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      {/* Controls bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="h-10 rounded-t-lg" style={{ background: "var(--card)" }} />
        <div className="divide-y" style={{ background: "var(--card2)", borderColor: "var(--border)" }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
