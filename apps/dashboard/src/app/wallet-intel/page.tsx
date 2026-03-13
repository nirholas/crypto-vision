/**
 * Wallet Intel Center — Page Route
 *
 * HQ-style command center for wallet intelligence across all chains.
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { WalletIntelDashboard } from '@/components/smart-money/WalletIntelDashboard';

export const metadata: Metadata = {
  title: 'Wallet Intel Center',
  description:
    'Cross-chain wallet intelligence dashboard — exchange flows, smart money positions, dormant wallet reactivations, and whale leaderboards.',
  openGraph: {
    title: 'Wallet Intel Center — Crypto Vision',
    description: 'Comprehensive wallet intelligence for crypto whales and smart money.',
  },
};

export default function WalletIntelPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen">
        <WalletIntelDashboard />
      </div>
      <Footer />
    </>
  );
}
