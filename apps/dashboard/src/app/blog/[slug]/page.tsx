import { getPostBySlug, getAllPostSlugs, getRelatedPosts, markdownToHtml } from '@/lib/blog';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static paths for all posts
export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map(slug => ({ slug }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found | CryptoNews Blog',
    };
  }

  // Build custom OG image URL
  const ogImageParams = new URLSearchParams({
    type: 'article',
    title: post.title.slice(0, 90),
    source: 'CryptoNews Blog',
    category: post.tags?.[0] || 'Blog',
  });

  return {
    title: `${post.title} | CryptoNews Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author.name],
      tags: post.tags,
      images: [{
        url: post.coverImage || `/api/og?${ogImageParams.toString()}`,
        width: 1200,
        height: 630,
        alt: post.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage || `/api/og?${ogImageParams.toString()}`],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post || post.draft) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(slug, 3);
  const htmlContent = markdownToHtml(post.content);

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
        <article className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-400 mb-8">
            <Link href="/blog" className="hover:text-white transition">
              Blog
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-500">{post.title}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {post.featured && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                  Featured
                </span>
              )}
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/blog/tag/${tag.toLowerCase()}`}
                  className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700 transition"
                >
                  {tag}
                </Link>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-3">
                {post.author.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <div className="text-white font-medium">{post.author.name}</div>
                  {post.author.twitter && (
                    <a
                      href={`https://twitter.com/${post.author.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      @{post.author.twitter}
                    </a>
                  )}
                </div>
              </div>
              <span className="hidden sm:block">•</span>
              <time dateTime={post.date} className="hidden sm:block">
                {format(new Date(post.date), 'MMMM d, yyyy')}
              </time>
              <span className="hidden sm:block">•</span>
              <span className="hidden sm:block">{post.readingTime} min read</span>
            </div>
          </header>

          {/* Cover Image */}
          {post.coverImage && (
            <div className="mb-8 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-invert prose-lg max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white
              prose-code:text-blue-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700
              prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-400
              prose-li:text-gray-300
              prose-table:text-gray-300 prose-th:text-white prose-td:border-gray-700
              prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {/* Share */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex items-center gap-4">
              <span className="text-gray-400">Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://example.com/blog/${post.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition"
                aria-label="Share on Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`https://example.com/blog/${post.slug}`)}&title=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition"
                aria-label="Share on LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Author Bio */}
          <div className="mt-8 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-start gap-4">
              {post.author.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <div className="text-lg font-medium text-white mb-1">
                  {post.author.name}
                </div>
                <p className="text-gray-400 text-sm">
                  The CryptoNews team brings you the latest insights on cryptocurrency news aggregation, 
                  market trends, and development tutorials.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="max-w-3xl mx-auto mt-16">
            <h2 className="text-2xl font-bold text-white mb-6">Related Posts</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map(related => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group block bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition"
                >
                  <div className="text-sm text-gray-400 mb-2">
                    {related.readingTime} min read
                  </div>
                  <h3 className="text-white font-medium group-hover:text-blue-400 transition line-clamp-2">
                    {related.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

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
