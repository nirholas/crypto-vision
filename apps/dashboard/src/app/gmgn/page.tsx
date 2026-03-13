/**
 * GMGN Monitor — Page Route
 *
 * Real-time smart money network visualization with animated trade flows.
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { GmgnMonitor } from '@/components/smart-money/GmgnMonitor';

export const metadata: Metadata = {
  title: 'GMGN Monitor — Smart Money Flow',
  description:
    'Real-time animated network visualization of smart money trades across BSC and Solana. Track wallet categories, PnL, and live trade flows.',
  openGraph: {
    title: 'GMGN Monitor — Crypto Vision',
    description: 'Watch smart money trades flow through wallet nodes in real time.',
  },
};

export default function GmgnMonitorPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen">
        <GmgnMonitor />
      </div>
      <Footer />
    </>
  );
}
