import { Radio } from 'lucide-react';

export default function LiveLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl">
            <Radio className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse" />
            <div className="h-4 w-64 bg-surface-elevated rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-surface-border p-3 animate-pulse">
              <div className="h-3 w-10 bg-surface-elevated rounded mb-2" />
              <div className="h-5 w-16 bg-surface-elevated rounded mb-1" />
              <div className="h-2.5 w-12 bg-surface-elevated rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface rounded-2xl border border-surface-border p-5 animate-pulse">
            <div className="h-[400px] bg-gradient-to-b from-surface to-background-secondary rounded-lg" />
          </div>
          <div className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse">
            <div className="h-[400px] bg-gradient-to-b from-surface to-background-secondary rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
