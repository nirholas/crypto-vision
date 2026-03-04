/**
 * Homepage Loading Skeleton
 */

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Price ticker skeleton */}
      <div className="bg-surface-inverse h-10 flex items-center">
        <div className="flex gap-8 px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-12 bg-surface-inverse rounded animate-pulse" />
              <div className="h-4 w-16 bg-surface-inverse rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Header skeleton */}
      <div className="border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="h-8 w-48 bg-surface-alt rounded animate-pulse" />
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 w-20 bg-surface-alt rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category pills skeleton */}
        <div className="flex flex-wrap gap-3 pb-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-28 bg-surface-alt rounded-full animate-pulse"
            />
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Main content skeleton */}
          <div>
            {/* Featured article skeleton */}
            <div className="mb-8">
              <div className="h-64 bg-surface-alt rounded-xl animate-pulse mb-4" />
              <div className="h-8 w-3/4 bg-surface-alt rounded animate-pulse mb-2" />
              <div className="h-4 w-1/2 bg-surface-alt rounded animate-pulse" />
            </div>

            {/* Article grid skeleton */}
            <div className="grid sm:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-alt rounded-xl border border-surface-border overflow-hidden"
                >
                  <div className="h-40 bg-surface-alt animate-pulse" />
                  <div className="p-4">
                    <div className="h-4 w-20 bg-surface-alt rounded animate-pulse mb-2" />
                    <div className="h-5 w-full bg-surface-alt rounded animate-pulse mb-1" />
                    <div className="h-5 w-2/3 bg-surface-alt rounded animate-pulse mb-3" />
                    <div className="h-3 w-24 bg-surface-alt rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Market stats skeleton */}
            <div className="bg-surface-alt rounded-xl border border-surface-border p-6">
              <div className="h-6 w-40 bg-surface-alt rounded animate-pulse mb-4" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-24 bg-surface-alt rounded animate-pulse" />
                    <div className="h-4 w-20 bg-surface-alt rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Trending skeleton */}
            <div className="bg-surface-alt rounded-xl border border-surface-border p-6">
              <div className="h-6 w-32 bg-surface-alt rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-surface-alt rounded animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-full bg-surface-alt rounded animate-pulse mb-1" />
                      <div className="h-3 w-1/2 bg-surface-alt rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
