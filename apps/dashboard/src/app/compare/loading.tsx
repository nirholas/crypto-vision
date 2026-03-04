/**
 * Compare Page Loading Skeleton
 */

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header skeleton */}
      <div className="border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title skeleton */}
        <div className="text-center mb-8">
          <div className="h-10 w-64 bg-surface-alt rounded animate-pulse mx-auto mb-2" />
          <div className="h-5 w-80 bg-surface-alt rounded animate-pulse mx-auto" />
        </div>

        {/* Search bar skeleton */}
        <div className="mb-8">
          <div className="h-12 w-full max-w-xl mx-auto bg-surface-alt rounded-xl border border-surface-border animate-pulse" />
        </div>

        {/* Selected coins skeleton */}
        <div className="flex justify-center gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2 bg-surface-alt rounded-full">
              <div className="w-6 h-6 bg-surface-alt rounded-full animate-pulse" />
              <div className="h-4 w-16 bg-surface-alt rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Comparison table skeleton */}
        <div className="bg-surface-alt rounded-xl border border-surface-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-surface-border">
            <div className="h-5 bg-surface-alt rounded animate-pulse" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-surface-alt rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-surface-alt rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table rows */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 p-4 border-b border-surface-border last:border-0"
            >
              <div className="h-4 w-24 bg-surface-alt rounded animate-pulse" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-4 w-20 bg-surface-alt rounded animate-pulse mx-auto" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
