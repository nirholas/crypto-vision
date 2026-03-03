import { type Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BillingDashboard from '@/components/billing/BillingDashboard';

export const metadata: Metadata = {
  title: 'Billing & Usage - Manage Your Subscription',
  description:
    'View your API usage, manage your subscription, download invoices, and monitor your billing.',
  robots: 'noindex, nofollow',
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BillingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header />
      <main className="pt-16">
        <BillingDashboard />
      </main>
      <Footer />
    </div>
  );
}
