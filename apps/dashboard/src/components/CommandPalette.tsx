'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  TrendingUp,
  Landmark,
  Flame,
  Rocket,
  Search,
  Scale,
  Folder,
  Tag,
  Info,
  Moon,
  Star,
  BookOpen,
  Share2,
  Image,
  Bookmark,
  Trash2,
  MapPin,
  Zap,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  category: 'navigation' | 'action' | 'search' | 'settings';
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Define available commands
  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: 'home',
        label: 'Go to Home',
        icon: Home,
        category: 'navigation',
        action: () => router.push('/'),
      },
      {
        id: 'markets',
        label: 'Go to Markets',
        icon: TrendingUp,
        category: 'navigation',
        action: () => router.push('/markets'),
      },
      {
        id: 'defi',
        label: 'Go to DeFi Dashboard',
        icon: Landmark,
        category: 'navigation',
        action: () => router.push('/defi'),
      },
      {
        id: 'trending',
        label: 'Go to Trending',
        icon: Flame,
        category: 'navigation',
        action: () => router.push('/trending'),
      },
      {
        id: 'movers',
        label: 'Go to Top Movers',
        icon: Rocket,
        category: 'navigation',
        action: () => router.push('/movers'),
      },
      {
        id: 'bitcoin',
        label: 'Go to Bitcoin News',
        icon: TrendingUp,
        category: 'navigation',
        action: () => router.push('/category/bitcoin'),
      },
      {
        id: 'ethereum',
        label: 'Go to Ethereum News',
        icon: TrendingUp,
        category: 'navigation',
        action: () => router.push('/category/ethereum'),
      },
      {
        id: 'nfts',
        label: 'Go to NFT News',
        icon: Image,
        category: 'navigation',
        action: () => router.push('/category/nft'),
      },
      {
        id: 'regulation',
        label: 'Go to Regulation News',
        icon: Scale,
        category: 'navigation',
        action: () => router.push('/category/regulation'),
      },
      {
        id: 'sources',
        label: 'Go to News Sources',
        icon: Folder,
        category: 'navigation',
        action: () => router.push('/sources'),
      },
      {
        id: 'topics',
        label: 'Go to Topics',
        icon: Tag,
        category: 'navigation',
        action: () => router.push('/topics'),
      },
      {
        id: 'about',
        label: 'Go to About',
        icon: Info,
        category: 'navigation',
        action: () => router.push('/about'),
      },

      // Search shortcuts
      {
        id: 'search-btc',
        label: 'Search Bitcoin news',
        icon: Search,
        category: 'search',
        action: () => router.push('/search?q=bitcoin'),
      },
      {
        id: 'search-eth',
        label: 'Search Ethereum news',
        icon: Search,
        category: 'search',
        action: () => router.push('/search?q=ethereum'),
      },
      {
        id: 'search-defi',
        label: 'Search DeFi news',
        icon: Search,
        category: 'search',
        action: () => router.push('/search?q=defi'),
      },
      {
        id: 'search-etf',
        label: 'Search ETF news',
        icon: Search,
        category: 'search',
        action: () => router.push('/search?q=etf'),
      },

      // Actions
      {
        id: 'toggle-theme',
        label: 'Toggle Dark Mode',
        description: 'Switch between light and dark theme',
        icon: Moon,
        category: 'action',
        shortcut: '⌘⇧D',
        action: () => {
          document.documentElement.classList.toggle('dark');
          localStorage.setItem(
            'darkMode',
            document.documentElement.classList.contains('dark').toString()
          );
        },
      },
      {
        id: 'github',
        label: 'Open GitHub Repository',
        icon: Star,
        category: 'action',
        action: () => window.open('https://github.com/nirholas/crypto-data-aggregator', '_blank'),
      },
      {
        id: 'api-docs',
        label: 'View API Documentation',
        icon: BookOpen,
        category: 'action',
        action: () => router.push('/about#api'),
      },
      {
        id: 'share',
        label: 'Share this site',
        icon: Share2,
        category: 'action',
        action: () => {
          if (navigator.share) {
            navigator.share({ title: 'Crypto Data Aggregator', url: window.location.href });
          } else {
            navigator.clipboard.writeText(window.location.href);
          }
        },
      },
      {
        id: 'bookmarks',
        label: 'View Bookmarks',
        icon: Bookmark,
        category: 'navigation',
        action: () => router.push('/bookmarks'),
      },

      // Settings
      {
        id: 'clear-cache',
        label: 'Clear Local Storage',
        description: 'Reset preferences and cache',
        icon: Trash2,
        category: 'settings',
        action: () => {
          localStorage.clear();
          window.location.reload();
        },
      },
    ],
    [router]
  );

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [query, commands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatCommands, selectedIndex, onClose]
  );

  // Execute command
  const executeCommand = (command: Command) => {
    command.action();
    onClose();
  };

  // Category labels
  const categoryLabels: Record<string, { label: string; icon: LucideIcon }> = {
    navigation: { label: 'Navigation', icon: MapPin },
    search: { label: 'Quick Search', icon: Search },
    action: { label: 'Actions', icon: Zap },
    settings: { label: 'Settings', icon: Settings },
  };

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 bg-surface rounded-2xl shadow-2xl overflow-hidden border border-surface-border animate-fade-in-up">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-border">
          <svg
            className="w-5 h-5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-0 text-text-primary placeholder-text-muted focus:outline-none focus:ring-0 text-base"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-medium text-text-muted bg-surface rounded border border-surface-border">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto scrollbar-hide py-2">
          {flatCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted">
              <div className="flex justify-center mb-2">
                <Search className="w-10 h-10" />
              </div>
              <p>No commands found for "{query}"</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => {
              const categoryConfig = categoryLabels[category] || { label: category, icon: MapPin };
              const CategoryIcon = categoryConfig.icon;
              return (
                <div key={category} className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <CategoryIcon className="w-3.5 h-3.5" />
                    {categoryConfig.label}
                  </div>
                  {cmds.map((cmd) => {
                    const currentIndex = globalIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    const IconComponent = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        data-index={currentIndex}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <span className="w-8 flex justify-center" aria-hidden="true">
                          <IconComponent className="w-5 h-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{cmd.label}</div>
                          {cmd.description && (
                            <div className="text-xs text-text-muted truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-0.5 text-xs font-medium text-text-muted bg-surface rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border bg-surface">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background rounded border border-surface-border">
                  ↑↓
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background rounded border border-surface-border">
                  ↵
                </kbd>
                select
              </span>
            </div>
            <span className="text-text-muted">{flatCommands.length} commands</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
