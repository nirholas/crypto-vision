'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface BookmarkedArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  savedAt: string;
}

interface BookmarksContextType {
  bookmarks: BookmarkedArticle[];
  addBookmark: (article: Omit<BookmarkedArticle, 'savedAt'>) => void;
  removeBookmark: (link: string) => void;
  isBookmarked: (link: string) => boolean;
  clearAll: () => void;
}

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

const STORAGE_KEY = 'crypto-news-bookmarks';

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBookmarks(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save bookmarks to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
      } catch (e) {
        console.error('Failed to save bookmarks:', e);
      }
    }
  }, [bookmarks, isLoaded]);

  const addBookmark = (article: Omit<BookmarkedArticle, 'savedAt'>) => {
    if (!isBookmarked(article.link)) {
      setBookmarks(prev => [
        { ...article, savedAt: new Date().toISOString() },
        ...prev
      ]);
    }
  };

  const removeBookmark = (link: string) => {
    setBookmarks(prev => prev.filter(b => b.link !== link));
  };

  const isBookmarked = (link: string) => {
    return bookmarks.some(b => b.link === link);
  };

  const clearAll = () => {
    setBookmarks([]);
  };

  return (
    <BookmarksContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked, clearAll }}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (context === undefined) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}
