export default function HeatmapLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 bg-surface-alt animate-pulse" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse mb-2" />
          <div className="h-5 w-96 bg-surface-alt rounded animate-pulse" />
        </div>

        {/* Controls skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-4">
            <div className="h-10 w-28 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-10 w-40 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-10 w-28 bg-surface-alt rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-6">
            <div className="h-5 w-20 bg-surface-alt rounded animate-pulse" />
            <div className="h-5 w-20 bg-surface-alt rounded animate-pulse" />
          </div>
        </div>

        {/* Legend skeleton */}
        <div className="flex justify-center mb-6">
          <div className="h-4 w-64 bg-surface-alt rounded animate-pulse" />
        </div>

        {/* Heatmap grid skeleton */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg animate-pulse"
              style={{
                backgroundColor: `hsl(0, 0%, ${30 + Math.random() * 50}%)`,
                animationDelay: `${i * 20}ms`,
              }}
            />
          ))}
        </div>

        {/* Summary skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-4 border-t border-surface-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-4 w-24 bg-surface-alt rounded animate-pulse mx-auto mb-2" />
              <div className="h-6 w-16 bg-surface-alt rounded animate-pulse mx-auto mb-1" />
              <div className="h-4 w-20 bg-surface-alt rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
