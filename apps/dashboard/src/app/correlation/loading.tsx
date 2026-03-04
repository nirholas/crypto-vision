export default function CorrelationLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-16 bg-surface-alt animate-pulse" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-52 bg-surface-alt rounded animate-pulse mb-2" />
          <div className="h-5 w-96 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="flex justify-center mb-6">
          <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
        </div>
        <div className="aspect-square max-w-xl mx-auto bg-surface-alt rounded animate-pulse" />
      </main>
    </div>
  );
}
