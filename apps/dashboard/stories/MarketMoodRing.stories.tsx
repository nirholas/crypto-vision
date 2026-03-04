import type { Meta, StoryObj } from '@storybook/react';
import MarketMoodRing, {
  MarketMoodBadge,
  MarketMoodSparkline,
} from '../src/components/MarketMoodRing';

const meta: Meta<typeof MarketMoodRing> = {
  title: 'Components/MarketMoodRing',
  component: MarketMoodRing,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A visually striking circular gauge that displays market sentiment based on the Fear & Greed Index.

## Features
- 🎨 Animated SVG rings with gradient fills
- 📊 Real-time fear/greed index display
- ✨ Pulsing glow effects based on market intensity
- 🖱️ Interactive hover states with detailed tooltips
- 📱 Responsive design with multiple size variants
- ♿ Full accessibility support

## Usage
\`\`\`tsx
import MarketMoodRing, { MarketMoodBadge, MarketMoodSparkline } from '@/components/MarketMoodRing';
import { useMarketMood } from '@/hooks/useMarketMood';

function Dashboard() {
  const { value, previousValue, history } = useMarketMood();
  
  return (
    <div>
      <MarketMoodRing value={value} previousValue={previousValue} />
      <MarketMoodBadge value={value} />
      <MarketMoodSparkline values={history} />
    </div>
  );
}
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Fear & Greed index value (0-100)',
    },
    previousValue: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Previous value for trend indication',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size variant of the ring',
    },
    showDetails: {
      control: 'boolean',
      description: 'Show detailed breakdown panel',
    },
    animated: {
      control: 'boolean',
      description: 'Enable/disable animations',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MarketMoodRing>;

// Default state
export const Default: Story = {
  args: {
    value: 50,
    size: 'md',
    showDetails: true,
    animated: true,
  },
};

// Extreme Fear
export const ExtremeFear: Story = {
  args: {
    value: 12,
    previousValue: 18,
    size: 'lg',
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Market is in extreme fear mode (0-20). Historically a buying opportunity.',
      },
    },
  },
};

// Fear
export const Fear: Story = {
  args: {
    value: 32,
    previousValue: 28,
    size: 'lg',
    showDetails: true,
  },
};

// Neutral
export const Neutral: Story = {
  args: {
    value: 50,
    size: 'lg',
    showDetails: true,
  },
};

// Greed
export const Greed: Story = {
  args: {
    value: 72,
    previousValue: 68,
    size: 'lg',
    showDetails: true,
  },
};

// Extreme Greed
export const ExtremeGreed: Story = {
  args: {
    value: 92,
    previousValue: 88,
    size: 'lg',
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Market is euphoric (80-100). Consider taking profits.',
      },
    },
  },
};

// Size Variants
export const SizeVariants: Story = {
  render: () => (
    <div className="flex items-end gap-8 flex-wrap justify-center">
      <div className="flex flex-col items-center">
        <MarketMoodRing value={65} size="sm" showDetails={false} />
        <span className="text-text-muted text-xs mt-2">Small</span>
      </div>
      <div className="flex flex-col items-center">
        <MarketMoodRing value={65} size="md" showDetails={false} />
        <span className="text-text-muted text-xs mt-2">Medium</span>
      </div>
      <div className="flex flex-col items-center">
        <MarketMoodRing value={65} size="lg" showDetails={false} />
        <span className="text-text-muted text-xs mt-2">Large</span>
      </div>
      <div className="flex flex-col items-center">
        <MarketMoodRing value={65} size="xl" showDetails={false} />
        <span className="text-text-muted text-xs mt-2">Extra Large</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Available in four size variants: sm, md, lg, and xl.',
      },
    },
  },
};

// All Mood States
export const AllMoodStates: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
      {[10, 30, 50, 70, 90].map((v) => (
        <MarketMoodRing key={v} value={v} size="sm" showDetails={false} />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All five mood states: Extreme Fear, Fear, Neutral, Greed, Extreme Greed.',
      },
    },
  },
};

// Without Details
export const WithoutDetails: Story = {
  args: {
    value: 45,
    size: 'lg',
    showDetails: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact version without the details panel.',
      },
    },
  },
};

// Static (No Animation)
export const StaticNoAnimation: Story = {
  args: {
    value: 75,
    size: 'lg',
    animated: false,
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Animations disabled for reduced motion preferences or performance.',
      },
    },
  },
};

// Badge Component
export const BadgeVariant: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <MarketMoodBadge value={12} />
        <MarketMoodBadge value={32} />
        <MarketMoodBadge value={50} />
        <MarketMoodBadge value={72} />
        <MarketMoodBadge value={92} />
      </div>
      <p className="text-text-muted text-sm">
        Compact badge version for headers or inline display.
      </p>
    </div>
  ),
};

// Sparkline Component
export const SparklineVariant: Story = {
  render: () => {
    const sampleHistory = [25, 28, 22, 35, 42, 38, 45];
    const bearishHistory = [65, 58, 52, 45, 38, 32, 28];
    const volatileHistory = [45, 65, 35, 70, 25, 55, 40];

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-6">
          <span className="text-text-muted text-sm w-20">Recovery:</span>
          <MarketMoodSparkline values={sampleHistory} />
        </div>
        <div className="flex items-center gap-6">
          <span className="text-text-muted text-sm w-20">Bearish:</span>
          <MarketMoodSparkline values={bearishHistory} />
        </div>
        <div className="flex items-center gap-6">
          <span className="text-text-muted text-sm w-20">Volatile:</span>
          <MarketMoodSparkline values={volatileHistory} />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Mini sparkline showing mood history over time.',
      },
    },
  },
};

// Dashboard Integration Example
export const DashboardExample: Story = {
  render: () => (
    <div className="p-6 bg-surface rounded-2xl border border-surface-border max-w-lg">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-text-primary font-semibold text-lg">Market Sentiment</h3>
          <p className="text-text-muted text-sm">Fear & Greed Index</p>
        </div>
        <MarketMoodBadge value={42} />
      </div>

      <div className="flex justify-center mb-6">
        <MarketMoodRing value={42} previousValue={38} size="lg" showDetails={false} />
      </div>

      <div className="border-t border-surface-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">7-Day Trend</span>
          <MarketMoodSparkline values={[25, 32, 28, 35, 38, 40, 42]} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of how to integrate all components in a dashboard widget.',
      },
    },
  },
};

// Interactive Demo
export const InteractiveDemo: Story = {
  args: {
    value: 50,
    size: 'xl',
    showDetails: true,
    animated: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Use the controls below to explore different configurations.',
      },
    },
  },
};
