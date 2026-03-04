'use client';

import { useBookmarks } from '@/components/BookmarksProvider';
import ShareButtons from '@/components/ShareButtons';
import Link from 'next/link';

export default function BookmarksPageContent() {
  const { bookmarks, removeBookmark, clearAll } = useBookmarks();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">🔖 Saved Articles</h1>
          <p className="text-text-secondary">
            {bookmarks.length} article{bookmarks.length !== 1 ? 's' : ''} saved locally
          </p>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all bookmarks?')) {
                clearAll();
              }
            }}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            Clear All
          </button>
        )}
      </div>

      {bookmarks.length > 0 ? (
        <div className="space-y-3">
          {bookmarks.map((article) => (
            <div
              key={article.link}
              className="bg-surface rounded-xl border border-surface-border p-5 hover:shadow-md transition"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-text-primary hover:text-primary transition line-clamp-2"
                  >
                    {article.title}
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                    <span className="font-medium text-text-secondary">{article.source}</span>
                    <span>•</span>
                    <span>Published: {formatDate(article.pubDate)}</span>
                    <span>•</span>
                    <span>Saved: {formatDate(article.savedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeBookmark(article.link)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                  title="Remove bookmark"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <ShareButtons title={article.title} url={article.link} />
                <Link
                  href={`/read?url=${encodeURIComponent(article.link)}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Read with AI Summary →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
          <div className="text-6xl mb-4">🔖</div>
          <h3 className="text-xl font-semibold text-text-secondary mb-2">No saved articles yet</h3>
          <p className="text-text-muted mb-6">
            Click the ☆ button on any article to save it for later
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Browse News
          </Link>
        </div>
      )}

      <div className="mt-8 p-4 bg-surface-alt rounded-lg text-sm text-text-secondary">
        <strong>Note:</strong> Bookmarks are stored locally in your browser. They won&apos;t sync
        across devices.
      </div>
    </div>
  );
}
