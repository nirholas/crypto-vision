import { Metadata } from 'next';
import VolatilityAnalysis from '@/components/VolatilityAnalysis';
import { Activity, TrendingUp, Shield, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Volatility Analysis | Crypto Data Aggregator',
  description:
    'Analyze cryptocurrency volatility, risk metrics, maximum drawdowns, and Sharpe ratios. Make informed decisions with comprehensive risk analysis.',
  openGraph: {
    title: 'Crypto Volatility Analysis',
    description: 'Real-time volatility metrics and risk analysis for top cryptocurrencies',
  },
};

const features = [
  {
    icon: Activity,
    title: 'Real-time Volatility',
    description: 'Track 7-day and 30-day annualized volatility for all major cryptocurrencies',
  },
  {
    icon: TrendingUp,
    title: 'Sharpe Ratio',
    description: 'Measure risk-adjusted returns to identify the best performing assets',
  },
  {
    icon: Shield,
    title: 'Risk Assessment',
    description: 'Categorized risk levels from low to extreme based on multiple factors',
  },
  {
    icon: BarChart3,
    title: 'Max Drawdown',
    description: 'Understand worst-case scenarios with historical drawdown analysis',
  },
];

export default function VolatilityPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-surface border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary">Volatility Analysis</h1>
          </div>
          <p className="text-text-secondary text-lg max-w-2xl">
            Comprehensive risk metrics and volatility indicators to help you understand the risk
            profile of your crypto investments.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-4 bg-surface rounded-xl border border-surface-border hover:border-primary/50 transition-colors"
            >
              <feature.icon className="w-5 h-5 text-primary mb-2" />
              <h3 className="font-medium text-text-primary mb-1">{feature.title}</h3>
              <p className="text-sm text-text-muted">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Main Analysis Component */}
        <VolatilityAnalysis />

        {/* Educational Section */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-surface rounded-xl p-6 border border-surface-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Understanding Volatility
            </h3>
            <div className="space-y-3 text-sm text-text-secondary">
              <p>
                <strong className="text-text-primary">Volatility</strong> measures how much an
                asset&apos;s price fluctuates over time. Higher volatility means greater price
                swings and potentially higher risk.
              </p>
              <p>
                Crypto markets are known for their high volatility compared to traditional assets.
                Bitcoin typically has 40-80% annualized volatility, while altcoins can exceed 100%.
              </p>
              <div className="pt-3 border-t border-surface-border">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gain" />
                    &lt;40% Low
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-warning" />
                    40-60% Medium
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-loss" />
                    &gt;60% High
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-surface-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Key Risk Metrics</h3>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Sharpe Ratio
                </div>
                <p className="text-text-muted ml-4">
                  Measures return per unit of risk. Above 1.0 is considered good, above 2.0 is
                  excellent.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Maximum Drawdown
                </div>
                <p className="text-text-muted ml-4">
                  The largest peak-to-trough decline. Shows worst-case historical loss.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Beta
                </div>
                <p className="text-text-muted ml-4">
                  Measures correlation to Bitcoin. Beta &gt; 1 means more volatile than BTC.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
