/**
 * Known Cryptocurrency Codes and Names
 * 
 * Adapted from crypto-news-rag known_cryptos.txt
 * Contains 200+ major cryptocurrencies for query extraction
 * 
 * Format: CODE: Name
 */

export const KNOWN_CRYPTOS: Record<string, string> = {
  // Top 50 by market cap
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether',
  USDC: 'USD Coin',
  BNB: 'BNB',
  ADA: 'Cardano',
  XRP: 'XRP',
  SOL: 'Solana',
  DOGE: 'Dogecoin',
  DOT: 'Polkadot',
  WBTC: 'Wrapped Bitcoin',
  TRX: 'TRON',
  DAI: 'Dai',
  AVAX: 'Avalanche',
  SHIB: 'Shiba Inu',
  LEO: 'UNUS SED LEO',
  MATIC: 'Polygon',
  LTC: 'Litecoin',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  NEAR: 'NEAR Protocol',
  XLM: 'Stellar',
  XMR: 'Monero',
  BCH: 'Bitcoin Cash',
  ETC: 'Ethereum Classic',
  ALGO: 'Algorand',
  ATOM: 'Cosmos',
  FLOW: 'Flow',
  VET: 'VeChain',
  XTZ: 'Tezos',
  MANA: 'Decentraland',
  HBAR: 'Hedera',
  APE: 'ApeCoin',
  SAND: 'The Sandbox',
  FIL: 'Filecoin',
  ICP: 'Internet Computer',
  THETA: 'Theta Network',
  ZEC: 'Zcash',
  AAVE: 'Aave',
  EOS: 'EOS',
  AXS: 'Axie Infinity',
  MKR: 'Maker',
  
  // DeFi tokens
  CRV: 'Curve DAO Token',
  SNX: 'Synthetix',
  COMP: 'Compound',
  SUSHI: 'SushiSwap',
  YFI: 'yearn.finance',
  LDO: 'Lido DAO',
  CVX: 'Convex Finance',
  FXS: 'Frax Share',
  BAL: 'Balancer',
  DYDX: 'dYdX',
  GRT: 'The Graph',
  LRC: 'Loopring',
  INCH: '1inch Network',
  CRO: 'Cronos',
  CAKE: 'PancakeSwap',
  
  // Layer 2 & Scaling
  OP: 'Optimism',
  ARB: 'Arbitrum',
  STRK: 'Starknet',
  IMX: 'Immutable X',
  METIS: 'Metis',
  BOBA: 'Boba Network',
  ZK: 'zkSync',
  MANTA: 'Manta Network',
  BLAST: 'Blast',
  MODE: 'Mode',
  SCROLL: 'Scroll',
  LINEA: 'Linea',
  BASE: 'Base',

  // Gaming & Metaverse
  ENJ: 'Enjin Coin',
  GALA: 'Gala',
  ILV: 'Illuvium',
  RNDR: 'Render Token',
  MAGIC: 'Magic',
  PRIME: 'Echelon Prime',
  PIXEL: 'Pixels',
  PORTAL: 'Portal',
  XAI: 'Xai',
  BEAM: 'Beam',
  SUPER: 'SuperVerse',
  
  // Infrastructure
  INJ: 'Injective',
  SEI: 'Sei',
  SUI: 'Sui',
  APT: 'Aptos',
  FTM: 'Fantom',
  KAVA: 'Kava',
  ONE: 'Harmony',
  CELO: 'Celo',
  ROSE: 'Oasis Network',
  MINA: 'Mina',
  CFX: 'Conflux',
  KDA: 'Kadena',
  EGLD: 'MultiversX',
  
  // Oracle & Data
  BAND: 'Band Protocol',
  API3: 'API3',
  TRB: 'Tellor',
  DIA: 'DIA',
  UMA: 'UMA',
  
  // Privacy
  DASH: 'Dash',
  SCRT: 'Secret',
  
  // Storage
  AR: 'Arweave',
  STORJ: 'Storj',
  SC: 'Siacoin',
  
  // AI & Compute
  FET: 'Fetch.ai',
  OCEAN: 'Ocean Protocol',
  AGIX: 'SingularityNET',
  NMR: 'Numeraire',
  TAO: 'Bittensor',
  AKT: 'Akash Network',
  GLM: 'Golem',
  AIOZ: 'AIOZ Network',
  WLD: 'Worldcoin',
  
  // Meme coins
  PEPE: 'Pepe',
  FLOKI: 'Floki',
  WIF: 'dogwifhat',
  BONK: 'Bonk',
  MEME: 'Memecoin',
  COQ: 'Coq Inu',
  BRETT: 'Brett',
  MOG: 'Mog Coin',
  
  // Stablecoins
  FRAX: 'Frax',
  TUSD: 'TrueUSD',
  USDP: 'Pax Dollar',
  GUSD: 'Gemini Dollar',
  PYUSD: 'PayPal USD',
  GHO: 'GHO',
  CUSD: 'Celo Dollar',
  
  // Exchange tokens
  OKB: 'OKB',
  GT: 'GateToken',
  MX: 'MX TOKEN',
  KCS: 'KuCoin Token',
  
  // Real World Assets
  ONDO: 'Ondo',
  PAXG: 'PAX Gold',
  XAUT: 'Tether Gold',
  RIO: 'Realio Network',
  MPL: 'Maple',
  CFG: 'Centrifuge',
  
  // Bitcoin ecosystem
  ORDI: 'ORDI',
  SATS: 'SATS',
  RATS: 'RATS',
  STX: 'Stacks',
  RUNE: 'THORChain',
  
  // Solana ecosystem
  JTO: 'Jito',
  JUP: 'Jupiter',
  RAY: 'Raydium',
  PYTH: 'Pyth Network',
  ORCA: 'Orca',
  MNDE: 'Marinade',
  MSOL: 'Marinade Staked SOL',
  
  // Cosmos ecosystem
  OSMO: 'Osmosis',
  TIA: 'Celestia',
  DYM: 'Dymension',
  KUJI: 'Kujira',
  LUNA: 'Terra',
  LUNC: 'Terra Classic',
  
  // Polkadot ecosystem
  KSM: 'Kusama',
  ASTR: 'Astar',
  GLMR: 'Moonbeam',
  ACA: 'Acala Token',
  INTR: 'Interlay',
  
  // Cross-chain
  W: 'Wormhole',
  AXL: 'Axelar',
  ZRO: 'LayerZero',
  CCIP: 'Chainlink CCIP',
  
  // Misc notable
  TON: 'Toncoin',
  KAS: 'Kaspa',
  QNT: 'Quant',
  VRA: 'Verasity',
  JASMY: 'JasmyCoin',
  ENS: 'Ethereum Name Service',
  RPL: 'Rocket Pool',
  SSV: 'SSV Network',
  PENDLE: 'Pendle',
  BLUR: 'Blur',
  LOOKS: 'LooksRare',
  X2Y2: 'X2Y2',
  GMX: 'GMX',
  GNS: 'Gains Network',
  RDNT: 'Radiant Capital',
  VELO: 'Velodrome Finance',
  AERO: 'Aerodrome Finance',
  
  // Perpetuals/Derivatives
  PERP: 'Perpetual Protocol',
  KWENTA: 'Kwenta',
  LYRA: 'Lyra',
  PREMIA: 'Premia',
  HEGIC: 'Hegic',
  OPYN: 'Opyn',
};

// Create reverse mapping: name -> code
export const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_CRYPTOS).map(([code, name]) => [name.toUpperCase(), code])
);

// Set of all valid codes for fast lookup
export const VALID_CODES = new Set(Object.keys(KNOWN_CRYPTOS));

// Common aliases and alternative names
export const CRYPTO_ALIASES: Record<string, string> = {
  'BITCOIN': 'BTC',
  'ETHEREUM': 'ETH',
  'ETHER': 'ETH',
  'BINANCE': 'BNB',
  'BINANCE COIN': 'BNB',
  'RIPPLE': 'XRP',
  'POLYGON': 'MATIC',
  'AVALANCHE': 'AVAX',
  'POLKADOT': 'DOT',
  'CHAINLINK': 'LINK',
  'UNISWAP': 'UNI',
  'LITECOIN': 'LTC',
  'MONERO': 'XMR',
  'STELLAR': 'XLM',
  'DOGECOIN': 'DOGE',
  'SHIBA': 'SHIB',
  'SHIBA INU': 'SHIB',
  'CARDANO': 'ADA',
  'SOLANA': 'SOL',
  'TRON': 'TRX',
  'COSMOS': 'ATOM',
  'TETHER': 'USDT',
  'USDC': 'USDC',
  'BITCOIN CASH': 'BCH',
  'ETHEREUM CLASSIC': 'ETC',
  'FANTOM': 'FTM',
  'HEDERA': 'HBAR',
  'NEAR': 'NEAR',
  'ALGORAND': 'ALGO',
  'APECOIN': 'APE',
  'SANDBOX': 'SAND',
  'THE SANDBOX': 'SAND',
  'DECENTRALAND': 'MANA',
  'AAVE': 'AAVE',
  'MAKER': 'MKR',
  'COMPOUND': 'COMP',
  'CURVE': 'CRV',
  'FILECOIN': 'FIL',
  'INTERNET COMPUTER': 'ICP',
  'OPTIMISM': 'OP',
  'ARBITRUM': 'ARB',
  'STARKNET': 'STRK',
  'CELESTIA': 'TIA',
  'SUI': 'SUI',
  'APTOS': 'APT',
  'SEI': 'SEI',
  'INJECTIVE': 'INJ',
  'RENDER': 'RNDR',
  'FETCH': 'FET',
  'FETCH.AI': 'FET',
  'WORLDCOIN': 'WLD',
  'BITTENSOR': 'TAO',
  'PEPE': 'PEPE',
  'FLOKI': 'FLOKI',
  'BONK': 'BONK',
  'TONCOIN': 'TON',
  'KASPA': 'KAS',
  'JUPITER': 'JUP',
  'PYTH': 'PYTH',
  'PENDLE': 'PENDLE',
  'BLUR': 'BLUR',
};

/**
 * Get code from either a code or name
 */
export function normalizeToCode(input: string): string | null {
  const upper = input.toUpperCase().trim();
  
  // Check if it's already a valid code
  if (VALID_CODES.has(upper)) {
    return upper;
  }
  
  // Check aliases
  if (CRYPTO_ALIASES[upper]) {
    return CRYPTO_ALIASES[upper];
  }
  
  // Check name to code mapping
  if (NAME_TO_CODE[upper]) {
    return NAME_TO_CODE[upper];
  }
  
  return null;
}
