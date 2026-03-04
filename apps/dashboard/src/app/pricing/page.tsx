import { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'API Pricing | Crypto Data Aggregator',
  description:
    'Flexible pricing for cryptocurrency market data API. Pay-per-request with x402 or subscribe for monthly access.',
};

const tiers = [
  {
    name: 'Free',
    id: 'free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic market data',
    features: [
      '100 requests/day',
      'Top 100 coins',
      'Basic market data',
      'JSON responses',
      'Community support',
    ],
    cta: 'Get Free Key',
    highlighted: false,
  },
  {
    name: 'Pro',
    id: 'pro',
    price: '$29',
    period: '/month',
    description: 'For developers and small projects',
    features: [
      '10,000 requests/day',
      'All coins & tokens',
      'Historical data',
      'CSV/JSON exports',
      'Webhooks',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    id: 'enterprise',
    price: '$99',
    period: '/month',
    description: 'For businesses and high-volume users',
    features: [
      'Unlimited requests',
      'All Pro features',
      'Custom endpoints',
      'SLA guarantee',
      'Dedicated support',
      'White-label options',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const payPerRequest = [
  { endpoint: '/api/v1/coins', price: '$0.001', description: 'List all coins' },
  { endpoint: '/api/v1/coin/:id', price: '$0.002', description: 'Single coin details' },
  { endpoint: '/api/v1/market-data', price: '$0.002', description: 'Global market stats' },
  { endpoint: '/api/v1/trending', price: '$0.001', description: 'Trending coins' },
  { endpoint: '/api/v1/export', price: '$0.01', description: 'Bulk data export' },
  { endpoint: '/api/v1/historical', price: '$0.005', description: 'Historical data' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">API Pricing</h1>
            <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
              Flexible pricing for every use case. Pay per request with crypto or subscribe for
              monthly access.
            </p>
          </div>

          {/* Subscription Tiers */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-lg border-2 p-8 ${
                  tier.highlighted ? 'border-[var(--primary)]' : 'border-[var(--surface-border)]'
                }`}
              >
                <div className="mb-6">
                  <h3 className="text-2xl font-bold">{tier.name}</h3>
                  <p className="text-[var(--text-secondary)] mt-1">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-[var(--text-secondary)]">{tier.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-[var(--gain)] flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={
                    tier.id === 'free'
                      ? '/developers'
                      : tier.id === 'pro'
                        ? '/pricing/upgrade?plan=pro'
                        : '/pricing/upgrade?plan=enterprise'
                  }
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors text-center block ${
                    tier.highlighted
                      ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                      : 'border-2 border-[var(--surface-border)] text-white hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* x402 Pay Per Request */}
          <div className="border-2 border-[var(--surface-border)] rounded-lg p-8 mb-16">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">x402 Micropayments</h2>
                <p className="text-[var(--text-secondary)]">
                  Pay per request with USDC on Base. No subscription needed.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">
                      Endpoint
                    </th>
                    <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">
                      Price
                    </th>
                    <th className="text-left py-3 px-4 text-[var(--text-secondary)] font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payPerRequest.map((item) => (
                    <tr key={item.endpoint} className="border-b border-[var(--surface-border)]">
                      <td className="py-3 px-4 font-mono text-sm">{item.endpoint}</td>
                      <td className="py-3 px-4 font-medium text-[var(--gain)]">{item.price}</td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-surface-alt rounded-lg">
              <h4 className="font-medium text-text-primary mb-2">How it works:</h4>
              <ol className="list-decimal list-inside space-y-1 text-text-secondary">
                <li>Make a request to any endpoint</li>
                <li>Receive HTTP 402 with payment details</li>
                <li>Send USDC on Base to the provided address</li>
                <li>Include transaction hash in X-Payment-Proof header</li>
                <li>Receive your data</li>
              </ol>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-text-primary text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-text-primary mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-text-secondary">
                  For subscriptions: Credit card, crypto (BTC, ETH, USDC). For pay-per-request: USDC
                  on Base via x402 protocol.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-text-primary mb-2">
                  Can I upgrade or downgrade my plan?
                </h3>
                <p className="text-text-secondary">
                  Yes, you can change your plan at any time. Upgrades take effect immediately,
                  downgrades at the next billing cycle.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">What happens if I exceed my rate limit?</h3>
                <p className="text-[var(--text-secondary)]">
                  You&apos;ll receive a 429 response. You can either wait for the reset, upgrade
                  your plan, or use x402 for additional requests.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Is there a free trial for Pro?</h3>
                <p className="text-[var(--text-secondary)]">
                  Yes! Pro includes a 7-day free trial. No credit card required to start.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16 p-8 bg-[var(--primary)] rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to get started?</h2>
            <p className="text-white/80 mb-6">
              Get your API key in seconds. No credit card required for free tier.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/developers"
                className="px-6 py-3 bg-white text-[var(--primary)] font-medium rounded-lg hover:bg-white/90 transition-colors"
              >
                View API Docs
              </Link>
              <Link
                href="/developers"
                className="px-6 py-3 border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
              >
                Get API Key
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
