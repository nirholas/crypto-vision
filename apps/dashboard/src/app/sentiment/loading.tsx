/**
 * Sentiment Page Loading Skeleton
 */

export default function SentimentLoading() {
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
          <div className="h-5 w-96 bg-surface-alt rounded animate-pulse mx-auto" />
        </div>

        {/* Fear & Greed skeleton */}
        <div className="bg-surface-alt rounded-xl border border-surface-border p-8 mb-8">
          <div className="flex flex-col items-center">
            <div className="h-6 w-48 bg-surface-alt rounded animate-pulse mb-6" />
            <div className="w-48 h-48 bg-surface-alt rounded-full animate-pulse mb-4" />
            <div className="h-12 w-24 bg-surface-alt rounded animate-pulse mb-2" />
            <div className="h-6 w-32 bg-surface-alt rounded animate-pulse" />
          </div>
        </div>

        {/* Historical chart skeleton */}
        <div className="bg-surface-alt rounded-xl border border-surface-border p-6 mb-8">
          <div className="h-6 w-48 bg-surface-alt rounded animate-pulse mb-6" />
          <div className="h-64 bg-surface-alt rounded animate-pulse" />
        </div>

        {/* Sentiment breakdown skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-surface-alt rounded-xl border border-surface-border p-6">
              <div className="h-6 w-40 bg-surface-alt rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-surface-alt rounded animate-pulse" />
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
