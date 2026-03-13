/**
 * Smart Money Flow — Page Route
 *
 * Real-time visualizer for whale movements, exchange flows, and smart money positions.
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SmartMoneyFlow } from '@/components/smart-money/SmartMoneyFlow';

export const metadata: Metadata = {
  title: 'Smart Money Flow',
  description:
    'Real-time visualization of whale fund movements, exchange flows, and smart money positions across Bitcoin, Ethereum, and more.',
  openGraph: {
    title: 'Smart Money Flow — Crypto Vision',
    description: 'Track whale movements and exchange flows in real time.',
  },
};

export default function SmartMoneyFlowPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen">
        <SmartMoneyFlow />
      </div>
      <Footer />
    </>
  );
}
