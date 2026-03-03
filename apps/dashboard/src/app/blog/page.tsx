import { getAllPosts, getAllTags } from '@/lib/blog';
import { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = {
  title: 'Blog | CryptoNews',
  description: 'Insights, tutorials, and updates about cryptocurrency news aggregation and the crypto ecosystem.',
  openGraph: {
    title: 'Blog | CryptoNews',
    description: 'Insights, tutorials, and updates about cryptocurrency news aggregation.',
    type: 'website',
  },
};

// Force dynamic rendering to pick up new posts
export const dynamic = 'force-dynamic';

export default function BlogPage() {
  const posts = getAllPosts();
  const tags = getAllTags();
  const featuredPosts = posts.filter(p => p.featured);
  const regularPosts = posts.filter(p => !p.featured);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-white">
              CryptoNews
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-gray-400 hover:text-white transition">
                Home
              </Link>
              <Link href="/blog" className="text-white font-medium">
                Blog
              </Link>
              <Link href="/developers" className="text-gray-400 hover:text-white transition">
                API
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            CryptoNews Blog
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Insights, tutorials, and updates about cryptocurrency news aggregation and the crypto ecosystem.
          </p>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {tags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/blog/tag/${tag}`}
                className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm hover:bg-gray-700 transition"
              >
                {tag} <span className="text-gray-500">({count})</span>
              </Link>
            ))}
          </div>
        )}

        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-6">Featured</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featuredPosts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-800/50 hover:border-blue-600/50 transition"
                >
                  {post.coverImage && (
                    <div className="h-48 mb-4 rounded-lg overflow-hidden bg-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                      Featured
                    </span>
                    <span>•</span>
                    <span>{post.readingTime} min read</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                    {post.title}
                  </h3>
                  <p className="text-gray-400 line-clamp-2 mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-3">
                    {post.author.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="text-sm">
                      <div className="text-gray-300">{post.author.name}</div>
                      <div className="text-gray-500">
                        {formatDistanceToNow(new Date(post.date), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All Posts */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            {featuredPosts.length > 0 ? 'Latest Posts' : 'All Posts'}
          </h2>
          
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-medium text-white mb-2">No posts yet</h3>
              <p className="text-gray-400">Check back soon for new content!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(featuredPosts.length > 0 ? regularPosts : posts).map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    {post.tags[0] && (
                      <>
                        <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                          {post.tags[0]}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>{post.readingTime} min read</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition">
                    {post.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{post.author.name}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(post.date), { addSuffix: true })}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Newsletter CTA */}
        <section className="mt-16 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-2xl p-8 md:p-12 border border-blue-800/50 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Stay Updated
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            Get the latest crypto news insights delivered to your inbox. No spam, just valuable content.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Subscribe
            </button>
          </form>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-gray-400">
              © {new Date().getFullYear()} CryptoNews. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <Link href="/developers" className="text-gray-400 hover:text-white transition">
                API
              </Link>
              <Link href="/blog" className="text-gray-400 hover:text-white transition">
                Blog
              </Link>
              <a
                href="https://github.com/nirholas/crypto-data-aggregator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
