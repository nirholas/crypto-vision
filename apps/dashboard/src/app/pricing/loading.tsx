export default function PricingLoading() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="text-center mb-16">
          <div className="h-10 w-48 bg-surface-alt rounded mx-auto mb-4 animate-pulse" />
          <div className="h-6 w-96 max-w-full bg-surface-alt rounded mx-auto animate-pulse" />
        </div>

        {/* Tier cards skeleton */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border-2 border-surface-border p-8">
              <div className="h-8 w-24 bg-surface-alt rounded mb-2 animate-pulse" />
              <div className="h-4 w-40 bg-surface-alt rounded mb-6 animate-pulse" />
              <div className="h-12 w-32 bg-surface-alt rounded mb-6 animate-pulse" />
              <div className="space-y-3 mb-8">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-4 bg-surface-alt rounded animate-pulse" />
                ))}
              </div>
              <div className="h-12 bg-surface-alt rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* x402 section skeleton */}
        <div className="border-2 border-surface-border rounded-lg p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-surface-alt rounded-lg animate-pulse" />
            <div>
              <div className="h-6 w-40 bg-surface-alt rounded mb-2 animate-pulse" />
              <div className="h-4 w-64 bg-surface-alt rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-surface-alt rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
