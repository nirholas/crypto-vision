export default function CalculatorLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 bg-surface-alt animate-pulse" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse mb-2" />
          <div className="h-5 w-80 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="space-y-8">
          <div className="h-48 bg-surface-alt rounded-xl animate-pulse" />
          <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
