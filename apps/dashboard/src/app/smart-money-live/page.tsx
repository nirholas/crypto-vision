/**
 * Smart Money Live — Page Route
 *
 * GMGN-style smart money dashboard with:
 * - Animated trade flow network visualization
 * - Real-time trade feed
 * - Wallet ranking cards
 *
 * Server component: loads wallet JSON data, generates simulated trades,
 * then passes serialized data to client components.
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SmartMoneyGMGN } from '@/components/smart-money/SmartMoneyGMGN';
import {
  getSmartMoneyData,
  getAllSmartWallets,
  getAllKOLWallets,
  getAllTrending,
  generateSimulatedTrades,
} from '@/lib/smart-money-data';

export const revalidate = 300; // ISR every 5 minutes

export const metadata: Metadata = {
  title: 'Smart Money Live — Crypto Vision',
  description:
    'Real-time smart money trade visualization across Solana and BSC. Track whale wallets, KOLs, and trending tokens with live trade flow animation.',
  openGraph: {
    title: 'Smart Money Live — Crypto Vision',
    description:
      'Track smart wallets and trending tokens in real-time with animated trade flow visualization.',
  },
};

export default async function SmartMoneyLivePage() {
  const data = await getSmartMoneyData();
  const wallets = getAllSmartWallets(data);
  const kolWallets = getAllKOLWallets(data);
  const trending = getAllTrending(data);
  const trades = generateSimulatedTrades(data, 200);

  const stats = {
    totalWallets: wallets.length,
    totalKOLs: kolWallets.length,
    totalTrades: trades.length,
    chains: 2,
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <SmartMoneyGMGN
          trades={trades}
          wallets={wallets}
          kolWallets={kolWallets}
          trending={trending}
          stats={stats}
        />
      </div>
      <Footer />
    </>
  );
}
