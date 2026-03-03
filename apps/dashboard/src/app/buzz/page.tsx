import type { Metadata } from 'next';
import { SocialBuzz } from '@/components/SocialBuzz';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Social Buzz | Trending Crypto',
  description:
    'See what cryptocurrencies are trending on social media. Track mentions, sentiment, and buzz across Twitter, Reddit, Discord, and Telegram.',
  openGraph: {
    title: 'Social Buzz 💬🔥',
    description: 'See what cryptocurrencies are trending on social media.',
    images: [{
      url: '/api/og?type=page&title=Social%20Buzz&subtitle=Trending%20Crypto%20Mentions',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social Buzz 💬🔥',
    description: 'See what cryptocurrencies are trending on social media.',
    images: ['/api/og?type=page&title=Social%20Buzz&subtitle=Trending%20Crypto%20Mentions'],
  },
};

export default function BuzzPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Social Buzz</h1>
              <p className="text-text-secondary">
                What&apos;s trending in crypto right now. Track social mentions and community sentiment.
              </p>
            </div>
            <ShareButtons
              url="/buzz"
              title="See what's trending in crypto right now! 💬🔥"
              variant="compact"
            />
          </div>
        </div>

        <SocialBuzz />
      </main>
      <Footer />
    </div>
  );
}
