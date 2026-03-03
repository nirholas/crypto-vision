/**
 * Root Layout
 * 
 * This is a minimal root layout that exists to handle the root route.
 * The actual layout with all providers is in [locale]/layout.tsx.
 * 
 * The middleware handles redirecting users to the appropriate locale,
 * so this layout primarily serves as a fallback and to satisfy Next.js
 * requirements for a root layout.
 */

import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
