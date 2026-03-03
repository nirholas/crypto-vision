import { redirect } from 'next/navigation';

// Redirect /source to sources list page
export default function SourcePage() {
  redirect('/sources');
}
