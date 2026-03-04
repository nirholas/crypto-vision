/**
 * Homepage Loading Skeleton
 *
 * Thin accent-colored loading bar at top, skeleton cards with shimmer effect,
 * and fade-in transitions. Uses CSS variables from design system.
 */

export default function HomeLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Thin accent loading bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full w-1/3 rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            animation: 'loading-bar 1.5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Price ticker skeleton */}
      <div className="h-10 flex items-center" style={{ background: 'var(--surface)' }}>
        <div className="flex gap-8 px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-12 skeleton rounded" />
              <div className="h-4 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Header skeleton */}
      <div style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="h-8 w-48 skeleton rounded" />
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 w-20 skeleton rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
        {/* Category pills skeleton */}
        <div className="flex flex-wrap gap-3 pb-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 w-28 skeleton rounded-full" />
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Main content skeleton */}
          <div>
            {/* Featured article skeleton */}
            <div className="mb-8">
              <div className="h-64 skeleton rounded-xl mb-4" />
              <div className="h-8 w-3/4 skeleton rounded mb-2" />
              <div className="h-4 w-1/2 skeleton rounded" />
            </div>

            {/* Article grid skeleton */}
            <div className="grid sm:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div className="h-40 skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-20 skeleton rounded" />
                    <div className="h-5 w-full skeleton rounded" />
                    <div className="h-5 w-2/3 skeleton rounded" />
                    <div className="h-3 w-24 skeleton rounded mt-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Market stats skeleton */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
            >
              <div className="h-6 w-40 skeleton rounded mb-4" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-24 skeleton rounded" />
                    <div className="h-4 w-20 skeleton rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Trending skeleton */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
            >
              <div className="h-6 w-32 skeleton rounded mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 skeleton rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-full skeleton rounded" />
                      <div className="h-3 w-1/2 skeleton rounded" />
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
