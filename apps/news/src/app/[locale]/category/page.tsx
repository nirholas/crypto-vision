import { redirect } from 'next/navigation';

// Redirect /category to topics page
export default function CategoryPage() {
  redirect('/topics');
}
