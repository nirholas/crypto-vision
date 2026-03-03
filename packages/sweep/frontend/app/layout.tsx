import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileBottomNav, FloatingActionButton } from "@/components/MobileNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sweep | Multi-Chain Dust Sweeper",
  description: "Sweep your dust tokens across multiple chains and convert them into DeFi positions",
  icons: {
    icon: "/sweep.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sweep",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#10b981",
          colorBackground: "#0a0a1a",
          colorText: "#ffffff",
          colorTextSecondary: "#a1a1aa",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={inter.className}>
          <Providers>
            <ErrorBoundary>
              {/* Main content with bottom padding for mobile nav */}
              <div className="pb-16 md:pb-0">{children}</div>
              
              {/* Mobile navigation */}
              <MobileBottomNav />
              <FloatingActionButton />
            </ErrorBoundary>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
