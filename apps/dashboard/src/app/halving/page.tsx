/**
 * Bitcoin Halving Page
 *
 * Dedicated page for Bitcoin halving countdown and education
 */

import { Metadata } from 'next';
import BitcoinHalvingCountdown from '@/components/BitcoinHalvingCountdown';
import { TrendingDown, HelpCircle, BarChart3, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bitcoin Halving Countdown | Crypto News',
  description:
    'Track the countdown to the next Bitcoin halving event. See block height, estimated date, and historical halving data.',
  openGraph: {
    title: 'Bitcoin Halving Countdown ⏳🪙',
    description: 'Track the countdown to the next Bitcoin halving event with live block data.',
    images: [{
      url: '/api/og?type=coin&title=Bitcoin%20Halving&subtitle=Countdown%20%26%20Historical%20Data&ticker=BTC',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bitcoin Halving Countdown ⏳🪙',
    description: 'Track the countdown to the next Bitcoin halving event with live block data.',
    images: ['/api/og?type=coin&title=Bitcoin%20Halving&subtitle=Countdown%20%26%20Historical%20Data&ticker=BTC'],
  },
};

export default function HalvingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 mb-6">
            <TrendingDown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Bitcoin Halving Countdown
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Track the countdown to the next Bitcoin halving event. The halving reduces mining
            rewards by 50%, historically impacting Bitcoin&apos;s supply dynamics and market cycles.
          </p>
        </div>

        {/* Main Countdown */}
        <div className="mb-12">
          <BitcoinHalvingCountdown variant="detailed" showHistory />
        </div>

        {/* Educational Content */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* What is Halving */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-3">What is a Halving?</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              A Bitcoin halving is a scheduled event that reduces the block reward miners receive by
              50%. This happens every 210,000 blocks (approximately every 4 years), controlling
              Bitcoin&apos;s inflation rate and moving toward the 21 million BTC supply cap.
            </p>
          </div>

          {/* Why It Matters */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <div className="w-12 h-12 rounded-xl bg-gain/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-gain" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-3">Why It Matters</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Historically, Bitcoin halvings have preceded significant bull runs. The reduced supply
              issuance, combined with steady or growing demand, has historically created upward
              price pressure in the 12-18 months following each halving event.
            </p>
          </div>

          {/* Schedule */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-3">Halving Schedule</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Bitcoin will continue halving until around 2140, when the final Bitcoin will be mined.
              The block reward will eventually become so small that miners will rely primarily on
              transaction fees for revenue.
            </p>
          </div>
        </div>

        {/* Block Reward Timeline */}
        <div className="bg-surface rounded-2xl border border-surface-border p-6 mb-12">
          <h3 className="text-xl font-bold text-text-primary mb-6">Block Reward Timeline</h3>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left py-3 px-4 font-semibold text-text-primary">Halving #</th>
                  <th className="text-left py-3 px-4 font-semibold text-text-primary">
                    Block Height
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-text-primary">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-text-primary">
                    Block Reward
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-text-primary">
                    Daily BTC
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-text-primary">% Mined</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { num: 0, block: 0, date: '2009-01-03', reward: 50, daily: 7200, pct: 0 },
                  { num: 1, block: 210000, date: '2012-11-28', reward: 25, daily: 3600, pct: 50 },
                  { num: 2, block: 420000, date: '2016-07-09', reward: 12.5, daily: 1800, pct: 75 },
                  {
                    num: 3,
                    block: 630000,
                    date: '2020-05-11',
                    reward: 6.25,
                    daily: 900,
                    pct: 87.5,
                  },
                  {
                    num: 4,
                    block: 840000,
                    date: '2024-04-20',
                    reward: 3.125,
                    daily: 450,
                    pct: 93.75,
                  },
                  {
                    num: 5,
                    block: 1050000,
                    date: '~2028',
                    reward: 1.5625,
                    daily: 225,
                    pct: 96.875,
                  },
                  {
                    num: 6,
                    block: 1260000,
                    date: '~2032',
                    reward: 0.78125,
                    daily: 112.5,
                    pct: 98.4375,
                  },
                ].map((row) => (
                  <tr
                    key={row.num}
                    className="border-b border-surface-border hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-3 px-4 text-text-primary font-medium">{row.num}</td>
                    <td className="py-3 px-4 text-text-secondary">{row.block.toLocaleString()}</td>
                    <td className="py-3 px-4 text-text-secondary">{row.date}</td>
                    <td className="py-3 px-4 text-right text-text-primary font-medium">
                      {row.reward} BTC
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      {row.daily.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {row.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-surface rounded-2xl border border-surface-border p-6">
          <h3 className="text-xl font-bold text-text-primary mb-6">Frequently Asked Questions</h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-text-primary mb-2">
                What happens when all Bitcoin is mined?
              </h4>
              <p className="text-text-secondary text-sm">
                When all 21 million Bitcoin have been mined (estimated around 2140), miners will no
                longer receive block rewards. Instead, they will earn solely from transaction fees,
                which are expected to increase as Bitcoin adoption grows and block space becomes
                more valuable.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-text-primary mb-2">
                Does the halving always cause price increases?
              </h4>
              <p className="text-text-secondary text-sm">
                While past halvings have preceded bull runs, past performance doesn&apos;t guarantee
                future results. Market conditions, global economics, regulatory environment, and
                adoption rates all play significant roles in Bitcoin&apos;s price movements.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-text-primary mb-2">
                How does halving affect miners?
              </h4>
              <p className="text-text-secondary text-sm">
                Halvings cut miner revenue in half overnight (in BTC terms). Less efficient miners
                may become unprofitable and shut down, while more efficient operations can gain
                market share. If the price doesn&apos;t compensate for the reduced rewards, some
                mining operations may consolidate or cease operations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
