/**
 * Ask Page
 * 
 * Full-page RAG-powered chat interface
 */

import { type Metadata } from 'next';
import { RAGChat } from '@/components/rag-chat';

export const metadata: Metadata = {
  title: 'Ask AI - Crypto News Assistant',
  description: 'Get instant answers about cryptocurrency news, market trends, Bitcoin, Ethereum, DeFi, NFTs, and more using our AI-powered assistant.',
  keywords: ['crypto', 'AI', 'assistant', 'news', 'bitcoin', 'ethereum', 'chat'],
  openGraph: {
    title: 'Ask AI - Crypto News Assistant',
    description: 'Get instant answers about cryptocurrency news and market trends.',
    type: 'website',
  },
};

export default function AskPage() {
  return (
    <main className="h-screen bg-gray-900">
      <RAGChat showSidebar={true} />
    </main>
  );
}
