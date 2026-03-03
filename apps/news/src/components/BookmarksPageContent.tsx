'use client';

import { useTranslations } from 'next-intl';
import { useBookmarks } from '@/components/BookmarksProvider';
import ShareButtons from '@/components/ShareButtons';
import { Link } from '@/i18n/navigation';

export default function BookmarksPageContent() {
  const t = useTranslations('bookmarks');
  const tCommon = useTranslations('common');
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
          <h1 className="text-4xl font-bold mb-2">🔖 {t('title')}</h1>
          <p className="text-gray-600">
            {bookmarks.length} {bookmarks.length !== 1 ? t('saved') : t('saved')}
          </p>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={() => {
              if (confirm(t('confirmRemoveAll'))) {
                clearAll();
              }
            }}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            {t('removeAll')}
          </button>
        )}
      </div>

      {bookmarks.length > 0 ? (
        <div className="space-y-3">
          {bookmarks.map((article) => (
            <div
              key={article.link}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition line-clamp-2"
                  >
                    {article.title}
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{article.source}</span>
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
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-6xl mb-4">🔖</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('empty')}</h3>
          <p className="text-gray-500 mb-6">
            {t('emptyDescription')}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {tCommon('viewAll')}
          </Link>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
        <strong>Note:</strong> Bookmarks are stored locally in your browser. They won&apos;t sync across devices.
      </div>
    </div>
  );
}
