import { getPostsByTag, getAllTags } from '@/lib/blog';
import { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ tag: string }>;
}

// Generate static paths for all tags
export async function generateStaticParams() {
  const tags = getAllTags();
  return tags.map(({ tag }) => ({ tag }));
}

// Generate metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
  
  return {
    title: `${capitalizedTag} Posts | CryptoNews Blog`,
    description: `Browse all blog posts tagged with ${tag}`,
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const posts = getPostsByTag(tag);
  const allTags = getAllTags();

  if (posts.length === 0) {
    notFound();
  }

  const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1);

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
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-8">
          <Link href="/blog" className="hover:text-white transition">
            Blog
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">Tag: {capitalizedTag}</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Posts tagged &quot;{capitalizedTag}&quot;
          </h1>
          <p className="text-gray-400">
            {posts.length} post{posts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Posts Grid */}
          <div className="lg:col-span-3">
            <div className="grid md:grid-cols-2 gap-6">
              {posts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    {post.featured && (
                      <>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                          Featured
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
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 sticky top-6">
              <h3 className="text-lg font-bold text-white mb-4">All Tags</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map(({ tag: t, count }) => (
                  <Link
                    key={t}
                    href={`/blog/tag/${t}`}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      t === tag
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {t} ({count})
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Back to Blog */}
        <div className="text-center mt-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>
        </div>
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
