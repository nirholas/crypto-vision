# UCAI Web Builder

**[mcp.ucai.tech](https://mcp.ucai.tech)** — Generate MCP servers in your browser with AI-powered security scanning.

## Features

- 🛡️ **Security Scanner** — Detects 50+ smart contract risks (rug pulls, honeypots, hidden mints)
- 📖 **Contract Whisperer** — Explains contracts in plain English
- ⚡ **Pro Templates** — Pre-built bundles for Flash Loans, Arbitrage, Yield Aggregators
- 🌙 **Dark/Light Mode** — Toggle between themes
- 📥 **ZIP Download** — Complete server with `server.py`, `requirements.txt`, `README.md`
- 🔗 **Share Links** — Send `?address=0x...&network=ethereum` to anyone
- 💾 **Local Storage** — Save servers to your browser (wallet optional)
- 📤 **Export/Import** — Backup your server list as JSON

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** + **shadcn/ui**
- **RainbowKit** + **wagmi** + **viem** (wallet connection)
- **JSZip** + **file-saver** (ZIP generation)
- **next-themes** (dark/light mode)
- **sonner** (toast notifications)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/analyze/    # Security scanner API
│   ├── layout.tsx      # Root layout with Toaster
│   └── page.tsx        # Main UI
├── components/
│   ├── contract-analyzer.tsx   # Security scanner UI
│   ├── providers.tsx           # Theme + Wallet providers
│   └── ui/                     # shadcn/ui components
└── lib/
    ├── contract-whisperer.ts   # Plain English explanations
    ├── generator.ts            # Python server generator
    ├── networks.ts             # Chain configs + ABI fetcher
    ├── security-scanner.ts     # 50+ risk pattern detection
    └── templates.ts            # Pro template definitions
```

## Supported Networks

- Ethereum Mainnet
- Polygon
- Arbitrum One
- Base
- Optimism
- BNB Smart Chain
- Avalanche C-Chain
- Custom RPC

## Deployment

Deploy to Vercel:

```bash
npm run build
vercel --prod
```

Or set up automatic deployments from the `main` branch.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](../LICENSE).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
