/**
 * Hero Article - Full-width featured hero for the top story
 * Inspired by CoinDesk/CoinTelegraph hero layouts
 */
'use client';

import Link from 'next/link';
import { generateArticleSlug } from '@/lib/archive-v2';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
}

interface HeroArticleProps {
  article: Article;
}

const sourceColors: Record<string, { bg: string; text: string; accent: string }> = {
  'CoinDesk': { bg: 'bg-blue-600', text: 'text-blue-600', accent: 'from-blue-600/20' },
  'The Block': { bg: 'bg-purple-600', text: 'text-purple-600', accent: 'from-purple-600/20' },
  'Decrypt': { bg: 'bg-emerald-600', text: 'text-emerald-600', accent: 'from-emerald-600/20' },
  'CoinTelegraph': { bg: 'bg-orange-500', text: 'text-orange-600', accent: 'from-orange-500/20' },
  'Bitcoin Magazine': { bg: 'bg-amber-500', text: 'text-amber-600', accent: 'from-amber-500/20' },
  'Blockworks': { bg: 'bg-indigo-600', text: 'text-indigo-600', accent: 'from-indigo-600/20' },
  'The Defiant': { bg: 'bg-pink-600', text: 'text-pink-600', accent: 'from-pink-600/20' },
  'Bloomberg Crypto': { bg: 'bg-blue-700', text: 'text-blue-700', accent: 'from-blue-700/20' },
  'Reuters Crypto': { bg: 'bg-orange-600', text: 'text-orange-600', accent: 'from-orange-600/20' },
  'CNBC Crypto': { bg: 'bg-sky-600', text: 'text-sky-600', accent: 'from-sky-600/20' },
  'Forbes Crypto': { bg: 'bg-red-700', text: 'text-red-700', accent: 'from-red-700/20' },
};

const defaultStyle = { bg: 'bg-gray-600', text: 'text-gray-600', accent: 'from-gray-600/20' };

export default function HeroArticle({ article }: HeroArticleProps) {
  const articleSlug = generateArticleSlug(article.title, article.pubDate);
  const style = sourceColors[article.source] || defaultStyle;

  return (
    <section className="relative">
      <Link 
        href={`/article/${articleSlug}`}
        className="group block relative overflow-hidden bg-gray-900 rounded-none md:rounded-3xl"
      >
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-r ${style.accent} via-transparent to-brand-500/10 opacity-60`} />
        
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4zIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0wLTZoLTJWMTJoMnY0em0wLTZoLTJWNmgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] bg-repeat" />
        </div>

        {/* Subtle accent line */}
        <div className={`absolute top-0 left-0 w-1 h-full ${style.bg}`} />

        {/* Content */}
        <div className="relative px-6 py-10 md:px-12 md:py-12 lg:px-16 lg:py-14 min-h-[240px] md:min-h-[280px] flex flex-col justify-end">
          {/* Top badges */}
          <div className="absolute top-6 left-6 md:top-8 md:left-12 lg:left-16 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-brand-500 text-black text-xs font-bold px-2.5 py-1 uppercase tracking-wider">
              Top Story
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 text-white ${style.bg}`}>
              {article.source}
            </span>
          </div>

          {/* Main content */}
          <div className="max-w-4xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight group-hover:text-brand-400 transition-colors duration-300 mb-3 md:mb-4">
              {article.title}
            </h1>
            
            {article.description && (
              <p className="text-gray-300 text-base md:text-lg lg:text-xl line-clamp-2 md:line-clamp-3 mb-6 leading-relaxed max-w-3xl">
                {article.description}
              </p>
            )}

            <div className="flex items-center gap-4 md:gap-6">
              <time className="text-gray-400 text-sm md:text-base" dateTime={article.pubDate}>
                {article.timeAgo}
              </time>
              <span className="inline-flex items-center text-brand-400 font-semibold text-sm md:text-base group-hover:text-brand-300 transition-colors">
                Read Full Story
                <svg 
                  className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent pointer-events-none" />
      </Link>
    </section>
  );
}
