export default function GasLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 bg-surface-alt animate-pulse" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-40 bg-surface-alt rounded animate-pulse mb-2" />
          <div className="h-5 w-72 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface-alt rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-surface-alt rounded-xl animate-pulse" />
      </main>
    </div>
  );
}
