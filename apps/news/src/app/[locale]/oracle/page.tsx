import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OracleChat } from '@/components/OracleChat';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'oracle' });
  return { 
    title: t('title'), 
    description: t('description') 
  };
}

export default function OraclePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <OracleChat />
    </main>
  );
}
