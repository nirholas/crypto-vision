import './globals.css';
import { Providers } from '@/components/shared/providers';
import { Toaster } from '@/components/ui/toast';

export const metadata = {
  title: 'Pump Swarm',
  description: 'Autonomous memecoin agent swarm dashboard',
  themeColor: '#0a0b12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
