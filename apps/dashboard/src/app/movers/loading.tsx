/**
 * Movers Page Loading Skeleton
 */

export default function MoversLoading() {
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
          <div className="h-10 w-48 bg-surface-alt rounded animate-pulse mx-auto mb-2" />
          <div className="h-5 w-72 bg-surface-alt rounded animate-pulse mx-auto" />
        </div>

        {/* Summary cards skeleton */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-surface-alt rounded-xl p-6 border border-surface-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-surface-alt rounded-lg animate-pulse" />
                <div className="h-6 w-32 bg-surface-alt rounded animate-pulse" />
              </div>
              <div className="h-8 w-24 bg-surface-alt rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Two column layout skeleton */}
        <div className="grid md:grid-cols-2 gap-8">
          {[...Array(2)].map((_, col) => (
            <div key={col} className="bg-surface-alt rounded-xl border border-surface-border p-6">
              <div className="h-6 w-32 bg-surface-alt rounded animate-pulse mb-6" />

              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-surface-alt rounded animate-pulse" />
                      <div className="w-8 h-8 bg-surface-alt rounded-full animate-pulse" />
                      <div className="h-4 w-24 bg-surface-alt rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-16 bg-surface-alt rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
