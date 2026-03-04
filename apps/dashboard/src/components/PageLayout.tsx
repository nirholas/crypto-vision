/**
 * PageLayout Component
 * Shared layout wrapper with Header and Footer for all pages
 * Ensures consistent navigation and styling across the site
 */

import Header from './Header';
import Footer from './Footer';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <Header />
      <main id="main-content" className={`flex-1 ${className}`} role="main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
