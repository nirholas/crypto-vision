import { redirect } from 'next/navigation';

// Redirect /coin to markets page - coins require a symbol
export default function CoinPage() {
  redirect('/markets');
}
