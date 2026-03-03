import Link from 'next/link';
import type { EnrichedArticle } from '@/lib/archive-v2';

interface RelatedArticlesProps {
  articles: EnrichedArticle[];
}

const sourceColors: Record<string, string> = {
  'CoinDesk': 'bg-blue-100 text-blue-800',
  'The Block': 'bg-purple-100 text-purple-800',
  'Decrypt': 'bg-green-100 text-green-800',
  'CoinTelegraph': 'bg-orange-100 text-orange-800',
  'Bitcoin Magazine': 'bg-yellow-100 text-yellow-800',
  'Blockworks': 'bg-indigo-100 text-indigo-800',
  'The Defiant': 'bg-pink-100 text-pink-800',
};

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border p-6">
      <h2 className="font-bold text-lg mb-4">📰 Related Articles</h2>
      
      <div className="space-y-4">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/article/${article.id}`}
            className="block group"
          >
            <article className="p-3 -mx-3 rounded-lg hover:bg-gray-50 transition">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${sourceColors[article.source]?.replace('text-', 'text-').split(' ')[0] || 'bg-gray-100'}`}>
                  {article.source.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-orange-600 transition">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{article.source}</span>
                    <span>•</span>
                    <span>{getTimeAgo(article.pub_date || article.first_seen)}</span>
                  </div>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <Link 
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          View all news →
        </Link>
      </div>
    </div>
  );
}
