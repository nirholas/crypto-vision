import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Terminal | Crypto Vision',
  description: 'Full-screen trading terminal for monitoring and controlling pump-agent swarm operations.',
};

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
