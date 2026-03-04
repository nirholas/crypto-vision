export default function ScreenerLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 bg-surface-alt animate-pulse" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse mb-2" />
          <div className="h-5 w-80 bg-surface-alt rounded animate-pulse" />
        </div>

        {/* Controls skeleton */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="h-10 w-64 bg-surface-alt rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
        </div>

        {/* Presets skeleton */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-surface-alt rounded-full animate-pulse" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="border border-surface-border rounded-lg overflow-hidden">
          <div className="h-12 bg-surface-alt animate-pulse" />
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="h-14 border-t border-surface-border flex items-center gap-4 px-4 animate-pulse"
            >
              <div className="w-4 h-4 bg-surface-alt rounded" />
              <div className="w-8 h-4 bg-surface-alt rounded" />
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-surface-alt rounded-full" />
                <div className="w-24 h-4 bg-surface-alt rounded" />
              </div>
              <div className="w-20 h-4 bg-surface-alt rounded ml-auto" />
              <div className="w-16 h-4 bg-surface-alt rounded" />
              <div className="w-20 h-4 bg-surface-alt rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
