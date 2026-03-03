import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <Header />
        
        <main className="px-4 py-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Protocol Not Found</h1>
            <p className="text-gray-600 dark:text-slate-400 mb-8">
              This DeFi protocol isn&apos;t in our database. It may have been delisted or the URL might be incorrect.
            </p>
            <Link 
              href="/defi" 
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
            >
              Browse DeFi Dashboard
            </Link>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
