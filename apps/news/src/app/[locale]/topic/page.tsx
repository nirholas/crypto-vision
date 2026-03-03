import { redirect } from 'next/navigation';

// Redirect /topic to topics list page
export default function TopicPage() {
  redirect('/topics');
}
