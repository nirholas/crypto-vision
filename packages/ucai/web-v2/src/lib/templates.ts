export interface TemplateContract {
  name: string;
  address: string;
  network: string;
  description: string;
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  longDescription: string;
  contracts: TemplateContract[];
  samplePrompts: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

export const TEMPLATES: Template[] = [
  // ⚡ Flash Loan Playground
  {
    id: "flash-loan-playground",
    name: "Flash Loan Playground",
    icon: "⚡",
    category: "Advanced Patterns",
    description: "Aave flash loans + Uniswap swaps for arbitrage simulation",
    longDescription: "Combine Aave V3 flash loans with Uniswap V3 swaps to simulate arbitrage opportunities. Claude can calculate profitable routes, estimate gas costs, and simulate the entire flash loan flow without risking real funds.",
    difficulty: "advanced",
    contracts: [
      {
        name: "Aave V3 Pool",
        address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        network: "ethereum",
        description: "Flash loan provider - borrow any asset for one transaction"
      },
      {
        name: "Uniswap V3 Router",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        network: "ethereum",
        description: "Execute swaps during flash loan"
      },
      {
        name: "Uniswap V3 Quoter",
        address: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
        network: "ethereum",
        description: "Get exact swap quotes for route planning"
      }
    ],
    samplePrompts: [
      "What's the max flash loan I can take for USDC?",
      "Simulate borrowing 1M USDC, swapping to ETH, then back - is it profitable?",
      "Find arbitrage opportunities between Uniswap pools right now",
      "Calculate the flash loan fee for borrowing 100 ETH"
    ]
  },

  // 📊 Multi-DEX Arbitrage Scanner
  {
    id: "multi-dex-arbitrage",
    name: "Multi-DEX Arbitrage Scanner",
    icon: "📊",
    category: "Advanced Patterns", 
    description: "Compare prices across Uniswap V2, V3, and Sushiswap",
    longDescription: "Real-time price comparison across major DEXs. Claude can identify price discrepancies, calculate potential profits after gas, and suggest optimal trade sizes for arbitrage opportunities.",
    difficulty: "advanced",
    contracts: [
      {
        name: "Uniswap V2 Router",
        address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        network: "ethereum",
        description: "Classic AMM - simpler pricing model"
      },
      {
        name: "Uniswap V2 Factory",
        address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        network: "ethereum",
        description: "Find all V2 pairs"
      },
      {
        name: "Uniswap V3 Quoter V2",
        address: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
        network: "ethereum",
        description: "Precise V3 quotes with tick data"
      },
      {
        name: "SushiSwap Router",
        address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        network: "ethereum",
        description: "Sushi AMM for price comparison"
      }
    ],
    samplePrompts: [
      "Compare ETH/USDC price across Uniswap V2, V3, and Sushi right now",
      "Find the best DEX to swap 10 ETH to USDC",
      "Is there an arbitrage opportunity on WBTC/ETH across DEXs?",
      "Calculate profit if I buy on Sushi and sell on Uni V3"
    ]
  },

  // 🌾 Yield Aggregator
  {
    id: "yield-aggregator",
    name: "Yield Aggregator Intel",
    icon: "🌾",
    category: "Advanced Patterns",
    description: "Yearn vaults + Convex + Curve pools APY tracking",
    longDescription: "Monitor yields across DeFi's top aggregators. Claude can compare APYs, track your positions, suggest optimal vault strategies, and alert you to better opportunities.",
    difficulty: "intermediate",
    contracts: [
      {
        name: "Yearn V3 Registry",
        address: "0xff31A1B020c868F6eA3f61Eb953344920EeCA3af",
        network: "ethereum",
        description: "All Yearn vaults and their strategies"
      },
      {
        name: "Convex Booster",
        address: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
        network: "ethereum",
        description: "Boosted Curve yields"
      },
      {
        name: "Curve Pool Registry",
        address: "0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5",
        network: "ethereum",
        description: "All Curve pools and rates"
      },
      {
        name: "Convex CVX Rewards",
        address: "0xCF50b810E57Ac33B91dCF525C6ddd9881B139332",
        network: "ethereum",
        description: "Track CVX staking rewards"
      }
    ],
    samplePrompts: [
      "What's the highest APY vault on Yearn right now?",
      "Compare stETH yields: Yearn vs Convex vs Curve direct",
      "How much am I earning on my Convex staked position?",
      "Find the best stable yield over 10% APY"
    ]
  },

  // 🔴 Liquidation Bot Intel
  {
    id: "liquidation-intel",
    name: "Liquidation Bot Intel",
    icon: "🔴",
    category: "Advanced Patterns",
    description: "Track Aave/Compound positions approaching liquidation",
    longDescription: "Monitor borrowing positions across lending protocols. Claude can identify positions at risk, calculate liquidation prices, and estimate liquidator profits. Essential for MEV research and risk management.",
    difficulty: "advanced",
    contracts: [
      {
        name: "Aave V3 Pool",
        address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        network: "ethereum",
        description: "Check user health factors"
      },
      {
        name: "Aave V3 Oracle",
        address: "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
        network: "ethereum",
        description: "Asset prices for liquidation calcs"
      },
      {
        name: "Compound V3 USDC Comet",
        address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
        network: "ethereum",
        description: "Compound V3 USDC market positions"
      },
      {
        name: "Compound V3 ETH Comet",
        address: "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
        network: "ethereum",
        description: "Compound V3 ETH market positions"
      }
    ],
    samplePrompts: [
      "Find Aave positions with health factor below 1.1",
      "What's the liquidation price for this address on Compound?",
      "How much profit would liquidating this position give?",
      "Alert me if any position I'm watching drops below 1.2 HF"
    ]
  },

  // 🔵 Base DeFi Starter
  {
    id: "base-defi-starter",
    name: "Base DeFi Starter",
    icon: "🔵",
    category: "Chain Specific",
    description: "Aerodrome + BaseSwap + top Base protocols",
    longDescription: "Everything you need to interact with Base's DeFi ecosystem. Aerodrome (the leading DEX), BaseSwap, and core infrastructure. Perfect for exploring Coinbase's L2.",
    difficulty: "beginner",
    contracts: [
      {
        name: "Aerodrome Router",
        address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        network: "base",
        description: "Base's #1 DEX - ve(3,3) model"
      },
      {
        name: "Aerodrome Voter",
        address: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
        network: "base",
        description: "Vote on emissions, track gauges"
      },
      {
        name: "BaseSwap Router",
        address: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86",
        network: "base",
        description: "Popular Base DEX alternative"
      },
      {
        name: "USDC on Base",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        network: "base",
        description: "Native USDC for Base"
      }
    ],
    samplePrompts: [
      "What are the best trading pairs on Aerodrome?",
      "Swap 0.1 ETH to USDC on Base - which DEX is better?",
      "Show me Aerodrome's top liquidity pools",
      "What's the veAERO voting APR right now?"
    ]
  },

  // 🟠 Arbitrum Perps
  {
    id: "arbitrum-perps",
    name: "Arbitrum Perps Suite",
    icon: "🟠",
    category: "Chain Specific",
    description: "GMX + Camelot + Radiant perpetuals ecosystem",
    longDescription: "Complete perpetual futures toolkit on Arbitrum. Trade leveraged positions on GMX, provide liquidity on Camelot, and earn yields on Radiant. Claude becomes your perps trading assistant.",
    difficulty: "advanced",
    contracts: [
      {
        name: "GMX Vault",
        address: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
        network: "arbitrum",
        description: "GMX perpetuals vault"
      },
      {
        name: "GMX Router",
        address: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
        network: "arbitrum",
        description: "Open/close perp positions"
      },
      {
        name: "GMX Position Router",
        address: "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868",
        network: "arbitrum",
        description: "Manage leveraged positions"
      },
      {
        name: "Camelot Router",
        address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
        network: "arbitrum",
        description: "Arbitrum native DEX"
      },
      {
        name: "Radiant Lending Pool",
        address: "0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1",
        network: "arbitrum",
        description: "Lend/borrow with RDNT rewards"
      }
    ],
    samplePrompts: [
      "What's the current funding rate on GMX for ETH longs?",
      "Open a 5x long on BTC with $1000 collateral - simulate it",
      "What's the GLP APY right now?",
      "Compare borrowing rates: Radiant vs Aave on Arbitrum"
    ]
  }
];

export function getTemplatesByCategory(templates: Template[]): Record<string, Template[]> {
  return templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);
}
