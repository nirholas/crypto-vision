/**
 * Premium UI Components Storybook
 * Showcases all premium design components
 */
import type { Meta, StoryObj } from '@storybook/react';
import Button from '../src/components/ui/Button';
import Card, { StatCard, FeatureCard, CardHeader, CardContent, CardFooter } from '../src/components/ui/Card';
import Badge, { PriceChangeBadge, RankBadge, StatusBadge, ChainBadge } from '../src/components/ui/Badge';
import { CircularProgress } from '../src/components/ui/Progress';
import { TrendingUp, Wallet, BarChart3, Zap } from 'lucide-react';

const meta: Meta = {
  title: 'Design System/Premium Components',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0D1421' }],
    },
  },
};

export default meta;

// Button Stories
export const Buttons: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Button Variants</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
          <Button variant="glass">Glass</Button>
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Button Sizes</h2>
        <div className="flex items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="xl">Extra Large</Button>
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Button Effects</h2>
        <div className="flex gap-4">
          <Button glow>With Glow</Button>
          <Button shine>With Shine</Button>
          <Button isLoading>Loading</Button>
          <Button leftIcon={<Wallet className="w-4 h-4" />}>With Icon</Button>
        </div>
      </section>
    </div>
  ),
};

// Card Stories
export const Cards: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Card Variants</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card variant="default" hover>
            <CardHeader title="Default Card" subtitle="With hover effect" />
            <CardContent>Standard card with surface background</CardContent>
          </Card>
          <Card variant="elevated">
            <CardHeader title="Elevated Card" />
            <CardContent>Higher shadow, more prominent</CardContent>
          </Card>
          <Card variant="glass">
            <CardHeader title="Glass Card" />
            <CardContent>Glassmorphism effect</CardContent>
          </Card>
          <Card variant="gradient">
            <CardHeader title="Gradient Card" />
            <CardContent>Top gradient accent bar</CardContent>
          </Card>
          <Card variant="interactive">
            <CardHeader title="Interactive Card" />
            <CardContent>Click feedback animation</CardContent>
          </Card>
          <Card variant="outline">
            <CardHeader title="Outline Card" />
            <CardContent>Border only, transparent</CardContent>
          </Card>
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Stat Cards</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard 
            label="Market Cap" 
            value="$2.4T" 
            change={3.24}
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard 
            label="24h Volume" 
            value="$84.2B" 
            change={-1.87}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <StatCard 
            label="BTC Dominance" 
            value="52.4%" 
            change={0.42}
          />
          <StatCard 
            label="Active Coins" 
            value="14,238" 
            trend="neutral"
          />
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Feature Cards</h2>
        <div className="grid grid-cols-3 gap-4">
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Real-Time Data"
            description="Live prices and market data updated every second via WebSocket."
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="Advanced Analytics"
            description="Comprehensive charts, correlations, and market insights."
          />
          <FeatureCard
            icon={<Wallet className="w-6 h-6" />}
            title="Portfolio Tracking"
            description="Track your holdings across multiple wallets and exchanges."
          />
        </div>
      </section>
    </div>
  ),
};

// Badge Stories
export const Badges: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Badge Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="gradient">Gradient</Badge>
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Special Badges</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Badge dot dotColor="green">Live</Badge>
          <Badge glow variant="success">Glow Effect</Badge>
          <PriceChangeBadge value={5.24} />
          <PriceChangeBadge value={-3.18} />
          <RankBadge rank={1} />
          <RankBadge rank={5} />
          <RankBadge rank={42} />
        </div>
      </section>
      
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Status & Chain Badges</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="online" />
          <StatusBadge status="offline" />
          <StatusBadge status="busy" />
          <StatusBadge status="away" />
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <ChainBadge chain="ethereum" />
          <ChainBadge chain="bsc" />
          <ChainBadge chain="polygon" />
          <ChainBadge chain="arbitrum" />
          <ChainBadge chain="solana" />
        </div>
      </section>
    </div>
  ),
};

// Progress Stories
export const Progress: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Circular Progress</h2>
        <div className="flex items-end gap-8">
          <CircularProgress value={75} size="sm" />
          <CircularProgress value={60} size="md" variant="gradient" />
          <CircularProgress value={45} size="lg" variant="success" label="Complete" />
          <CircularProgress value={25} size="xl" variant="danger" />
        </div>
      </section>
    </div>
  ),
};

// Combined Showcase
export const DesignShowcase: StoryObj = {
  render: () => (
    <div className="space-y-12 p-8 bg-[#0D1421] min-h-screen">
      <header className="section-header">
        <h1 className="section-title text-2xl">Premium Design System</h1>
      </header>
      
      {/* Glass Card Demo */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Glassmorphism Effect</h2>
        <p className="text-[var(--text-secondary)]">
          Premium frosted glass effect with backdrop blur and subtle borders.
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="primary" glow>Get Started</Button>
          <Button variant="glass">Learn More</Button>
        </div>
      </div>
      
      {/* Gradient Border Demo */}
      <div className="gradient-border bg-surface rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">Gradient Border</h2>
        <p className="text-[var(--text-secondary)]">
          Animated gradient border using CSS masks.
        </p>
      </div>
      
      {/* Glow Effects */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-surface rounded-xl p-6 glow-primary">
          <h3 className="font-bold text-white">Primary Glow</h3>
        </div>
        <div className="bg-surface rounded-xl p-6 glow-gain">
          <h3 className="font-bold text-white">Success Glow</h3>
        </div>
        <div className="bg-surface rounded-xl p-6 glow-loss">
          <h3 className="font-bold text-white">Danger Glow</h3>
        </div>
      </div>
      
      {/* Live Indicator */}
      <div className="live-pulse bg-surface rounded-xl p-6 inline-block">
        <span className="text-white">Live Data Streaming</span>
      </div>
    </div>
  ),
};
