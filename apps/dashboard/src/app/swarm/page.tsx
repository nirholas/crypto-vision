import { Metadata } from 'next';
import { SwarmMonitor } from '@/components/SwarmMonitor';
import { SwarmStarter } from '@/components/SwarmStarter';

export const metadata: Metadata = {
  title: 'AI Agent Swarm Monitor | Crypto Vision',
  description: 'Real-time autonomous AI agent swarm monitoring with live narration and metrics.',
  openGraph: {
    title: 'AI Agent Swarm Monitor',
    description: 'Real-time autonomous AI agent swarm monitoring',
    type: 'website',
  },
};

export default function SwarmPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 mb-4">
            Autonomous AI Agent Swarm
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Watch as autonomous AI agents collaborate to create, launch, and trade tokens with zero human intervention.
          </p>
        </div>

        {/* Starter Card */}
        <div className="flex justify-center">
          <SwarmStarter />
        </div>

        {/* Monitor */}
        <SwarmMonitor />
      </div>
    </div>
  );
}
