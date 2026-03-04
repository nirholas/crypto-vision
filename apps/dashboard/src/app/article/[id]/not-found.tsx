import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function ArticleNotFound() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />
        
        <main className="px-4 py-16">
          <div className="max-w-lg mx-auto text-center">
            <div className="text-8xl mb-6">📰</div>
            <h1 className="text-3xl font-bold mb-4">Article Not Found</h1>
            <p className="text-text-muted mb-8">
              This article isn't in our archive yet. It may be too new or the link might be incorrect.
            </p>
            
            <div className="space-y-4">
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
              >
                Browse Latest News
              </Link>
              
              <p className="text-sm text-text-muted">
                Our archive collects articles hourly. Check back soon!
              </p>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
