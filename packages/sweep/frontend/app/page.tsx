import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";

// Chain logos as SVG components for professional look
const ChainLogos = {
  ethereum: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6" fill="currentColor">
      <path d="M16 0l-0.5 1.7v20.3l0.5 0.5 9-5.3z" opacity="0.6"/>
      <path d="M16 0l-9 17.2 9 5.3v-9.5z"/>
      <path d="M16 24.5l-0.3 0.3v6.9l0.3 0.8 9-12.7z" opacity="0.6"/>
      <path d="M16 32.5v-8l-9-5.3z"/>
      <path d="M16 22.5l9-5.3-9-4.1z" opacity="0.2"/>
      <path d="M7 17.2l9 5.3v-9.4z" opacity="0.6"/>
    </svg>
  ),
  base: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#0052FF"/>
      <path d="M16 6c-5.5 0-10 4.5-10 10s4.5 10 10 10c5.2 0 9.5-4 10-9h-6c-0.4 2.3-2.4 4-4.8 4-2.8 0-5-2.2-5-5s2.2-5 5-5c2.4 0 4.4 1.7 4.8 4h6c-0.5-5-4.8-9-10-9z" fill="white"/>
    </svg>
  ),
  arbitrum: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#28A0F0"/>
      <path d="M16.5 8l-7 12h3.5l3.5-6 3.5 6h3.5l-7-12z" fill="white"/>
      <path d="M13 20l-2 3.5h10l-2-3.5h-6z" fill="white"/>
    </svg>
  ),
  polygon: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#8247E5"/>
      <path d="M21 13l-3-1.7-3 1.7v3.4l3 1.7 3-1.7v-3.4zm-6 7.8l-3-1.7v-3.4l3-1.7 3 1.7v3.4l-3 1.7zm-3-8.5l3-1.7 3 1.7v-3.4l-3-1.7-3 1.7v3.4z" fill="white"/>
    </svg>
  ),
  bnb: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#F0B90B"/>
      <path d="M16 8l-2.5 2.5 2.5 2.5 2.5-2.5L16 8zm-5 5l-2.5 2.5 2.5 2.5 2.5-2.5L11 13zm10 0l-2.5 2.5 2.5 2.5 2.5-2.5L21 13zm-5 5l-2.5 2.5 2.5 2.5 2.5-2.5L16 18z" fill="white"/>
    </svg>
  ),
  optimism: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#FF0420"/>
      <circle cx="12" cy="16" r="4" fill="white"/>
      <path d="M18 12h2c2.2 0 4 1.8 4 4s-1.8 4-4 4h-2v-8z" fill="white"/>
    </svg>
  ),
  solana: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#000"/>
      <linearGradient id="solana-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00FFA3"/>
        <stop offset="100%" stopColor="#DC1FFF"/>
      </linearGradient>
      <path d="M9 19.5h11l2-2.5H11l-2 2.5zm0-5h14l-2-2.5H9l0 2.5zm14 10H9l2-2.5h14l-2 2.5z" fill="url(#solana-grad)"/>
    </svg>
  ),
  linea: () => (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle cx="16" cy="16" r="14" fill="#121212"/>
      <path d="M8 22h16v-2H10V10h-2v12zm4-4h10v-2H12v2z" fill="white"/>
    </svg>
  ),
};

const stats = [
  { value: "$2.4M+", label: "Dust Swept" },
  { value: "12K+", label: "Transactions" },
  { value: "8", label: "Chains" },
  { value: "0.1%", label: "Protocol Fee" },
];

const features = [
  {
    title: "Multi-Chain Scanning",
    description: "Instantly detect dust across Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Linea, and Solana.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    title: "Gasless Execution",
    description: "Pay transaction fees with any token you're sweeping. No native gas tokens required.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Best Price Routing",
    description: "Aggregated routing through 1inch, Jupiter, CoW Protocol, and Li.Fi for optimal execution.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: "DeFi Yield Routing",
    description: "Deposit directly into Aave, Lido, Yearn, or Beefy vaults in a single transaction.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    title: "MEV Protection",
    description: "Batch auctions via CoW Protocol protect against sandwich attacks and front-running.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Cross-Chain Consolidation",
    description: "Bridge and consolidate dust from multiple chains to your preferred destination.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Subtle grid background */}
      <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-lg">S</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">Sweep</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <a href="https://github.com/nirholas/sweep" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="https://github.com/nirholas/sweep" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
          </nav>
          
          <WalletConnect />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-card/50 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle" />
              <span className="text-sm text-muted-foreground">Live on 8 chains</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Turn dust into
              <br />
              <span className="gradient-text">yield</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Sweep consolidates small token balances across multiple chains and routes them 
              into DeFi yield positions — all without needing native gas tokens.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Launch App
              </Link>
              <a
                href="https://github.com/nirholas/sweep"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 border rounded-xl font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
            </div>
            
            {/* Chain logos */}
            <div className="flex flex-wrap justify-center gap-6">
              {Object.entries(ChainLogos).map(([name, Logo]) => (
                <div
                  key={name}
                  className="w-12 h-12 rounded-xl border bg-card flex items-center justify-center hover:border-foreground/20 transition-colors"
                  title={name.charAt(0).toUpperCase() + name.slice(1)}
                >
                  <Logo />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-card/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Professional-grade infrastructure
            </h2>
            <p className="text-muted-foreground">
              Built for DeFi power users who want to maximize the value of every token.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border bg-card hover:border-foreground/20 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three steps to clean
            </h2>
            <p className="text-muted-foreground">
              From dust to yield in under a minute.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Connect", description: "Link your wallet and we'll scan all supported chains for dust tokens." },
              { step: "02", title: "Select", description: "Choose which tokens to sweep and your destination (stablecoin, yield vault, etc)." },
              { step: "03", title: "Sweep", description: "Sign one transaction. We handle the rest — routing, bridging, and depositing." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-bold text-muted-foreground/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to sweep?
            </h2>
            <p className="text-muted-foreground mb-8">
              Stop leaving value on the table. Consolidate your dust today.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex px-8 py-4 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Launch App
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background text-lg">S</span>
              </div>
              <span className="text-sm text-muted-foreground">
                © 2026 Sweep. Open source under Apache 2.0
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://github.com/nirholas/sweep" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
