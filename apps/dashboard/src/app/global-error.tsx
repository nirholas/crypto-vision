'use client';

import { ErrorFallback } from '@/components/ErrorBoundary';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#0a0a0f', color: '#e4e4e7' }}
      >
        <ErrorFallback
          error={error}
          onRetry={reset}
          title="Something went wrong!"
          description="An unexpected error occurred. Please try again or reload the page."
        />
      </body>
    </html>
  );
}
