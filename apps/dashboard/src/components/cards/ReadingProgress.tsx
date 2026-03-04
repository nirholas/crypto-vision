/**
 * ReadingProgress Component
 * Shows a progress bar for partially read articles
 */

interface ReadingProgressProps {
  progress: number; // 0-100
  className?: string;
}

export default function ReadingProgress({ progress, className = '' }: ReadingProgressProps) {
  if (progress <= 0) return null;

  const isComplete = progress >= 100;

  return (
    <div className={`relative ${className}`}>
      {/* Progress bar background */}
      <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-gain' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Reading progress: ${progress}%`}
        />
      </div>

      {/* Progress label (optional, shown on hover) */}
      {isComplete ? (
        <span className="absolute -top-6 right-0 text-xs text-gain font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          ✓ Read
        </span>
      ) : (
        <span className="absolute -top-6 right-0 text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          {progress}% read
        </span>
      )}
    </div>
  );
}
