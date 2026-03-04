import { TrendingUp } from 'lucide-react';

export default function YieldsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-gain/10 rounded-xl">
            <TrendingUp className="w-6 h-6 text-gain" />
          </div>
          <div>
            <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse" />
            <div className="h-4 w-72 bg-surface-elevated rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse">
              <div className="h-3 w-16 bg-surface-elevated rounded mb-3" />
              <div className="h-6 w-20 bg-surface-elevated rounded" />
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-surface-border p-5 mb-8 animate-pulse">
          <div className="h-72 bg-gradient-to-b from-surface to-background-secondary rounded-lg" />
        </div>
      </div>
    </div>
  );
}
