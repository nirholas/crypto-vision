'use client';

import { useBookmarks } from './BookmarksProvider';

interface BookmarkButtonProps {
  article: {
    title: string;
    link: string;
    source: string;
    pubDate: string;
  };
  size?: 'sm' | 'md';
}

export default function BookmarkButton({ article, size = 'md' }: BookmarkButtonProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const bookmarked = isBookmarked(article.link);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (bookmarked) {
      removeBookmark(article.link);
    } else {
      addBookmark(article);
    }
  };

  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-lg';

  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses} flex items-center justify-center rounded-full transition-all ${
        bookmarked
          ? 'bg-warning/20 text-warning hover:bg-warning/30'
          : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-secondary'
      }`}
      title={bookmarked ? 'Remove bookmark' : 'Save for later'}
      aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
    >
      {bookmarked ? '★' : '☆'}
    </button>
  );
}
