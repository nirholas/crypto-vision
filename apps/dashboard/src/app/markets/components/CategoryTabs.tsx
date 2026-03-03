'use client';

/**
 * Category Tabs Component
 * Horizontal scrollable category filter tabs
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useEffect, useState } from 'react';
import { getCategoryIcon } from '@/lib/category-icons';
import {
  Globe,
  Landmark,
  Image,
  Gamepad2,
  Link2,
  Package,
  Dog,
  Bot,
  ArrowLeftRight,
  DollarSign,
  Lock,
  HardDrive,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Globe,
  defi: Landmark,
  nft: Image,
  gaming: Gamepad2,
  'layer-1': Link2,
  'layer-2': Package,
  meme: Dog,
  ai: Bot,
  exchange: ArrowLeftRight,
  stablecoin: DollarSign,
  privacy: Lock,
  storage: HardDrive,
};

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'defi', name: 'DeFi' },
  { id: 'nft', name: 'NFT' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'layer-1', name: 'Layer 1' },
  { id: 'layer-2', name: 'Layer 2' },
  { id: 'meme', name: 'Memes' },
  { id: 'ai', name: 'AI' },
  { id: 'exchange', name: 'Exchange' },
  { id: 'stablecoin', name: 'Stablecoins' },
  { id: 'privacy', name: 'Privacy' },
  { id: 'storage', name: 'Storage' },
];

interface CategoryTabsProps {
  activeCategory?: string;
}

export default function CategoryTabs({ activeCategory = 'all' }: CategoryTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScrollPosition = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
    }
    return () => {
      container?.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (categoryId === 'all') {
        params.delete('category');
      } else {
        params.set('category', categoryId);
      }

      // Reset to page 1 when changing category
      params.delete('page');

      const queryString = params.toString();
      router.push(`/markets${queryString ? `?${queryString}` : ''}`);
    },
    [router, searchParams]
  );

  return (
    <div className="mb-4">
      {/* Tabs container */}
      <div ref={scrollRef} className="flex flex-wrap gap-2 px-1 py-1">
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-sm transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface-hover text-text-secondary hover:bg-surface-alt'
              }`}
            >
              {(() => {
                const IconComponent = CATEGORY_ICONS[category.id] || Globe;
                return <IconComponent className="w-4 h-4" />;
              })()}
              <span>{category.name}</span>
            </button>
          );
        })}

        {/* View all categories link */}
        <a
          href="/markets/categories"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-sm bg-surface-hover text-text-secondary hover:bg-surface-alt transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>More</span>
        </a>
      </div>

    </div>
  );
}
