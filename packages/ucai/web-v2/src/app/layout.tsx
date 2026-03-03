import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UCAI — MCP Server Builder | AI Smart Contract Tools",
  description: "Turn any smart contract into Claude tools. Generate MCP servers from Ethereum ABIs with built-in security scanning. The ultimate vibe coding companion for Web3.",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "Claude",
    "AI",
    "smart contracts",
    "Ethereum",
    "blockchain",
    "Web3",
    "DeFi",
    "NFT",
    "security scanner",
    "ABI",
    "TypeScript",
    "vibe coding",
    "AI coding assistant",
    "crypto tools",
    "UCAI",
    "contract analyzer",
    "rug pull detector",
  ],
  authors: [{ name: "UCAI", url: "https://github.com/nirholas/UCAI" }],
  creator: "UCAI",
  publisher: "UCAI",
  metadataBase: new URL("https://mcp.ucai.tech"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mcp.ucai.tech",
    siteName: "UCAI",
    title: "UCAI — Turn Smart Contracts into Claude Tools",
    description: "Generate MCP servers from Ethereum ABIs. AI-powered security scanning. Built for vibecoders.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "UCAI — MCP Server Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UCAI — MCP Server Builder",
    description: "Turn any smart contract into Claude tools. AI-powered security scanning for Web3.",
    creator: "@ucai_tech",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  category: "technology",
};

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "UCAI",
  alternateName: "Universal Chain AI",
  description: "Turn any smart contract into Claude tools. Generate MCP servers from Ethereum ABIs with built-in security scanning.",
  url: "https://mcp.ucai.tech",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Organization",
    name: "UCAI",
    url: "https://github.com/nirholas/UCAI",
  },
  keywords: "MCP, Model Context Protocol, Claude, AI, smart contracts, Ethereum, blockchain, Web3, vibe coding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
