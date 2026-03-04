/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CRYPTO DATA AGGREGATOR - DESIGN TOKEN SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * SINGLE SOURCE OF TRUTH for all colors in the application.
 *
 * Architecture:
 * 1. CSS Variables (:root in globals.css) - Primary source
 * 2. This file - TypeScript reference for JS/TS code
 * 3. tailwind.config.js - References CSS variables
 *
 * Theme: CMC/CoinGecko inspired deep navy with blue accents
 *
 * Usage:
 * - Components: Use Tailwind classes (bg-surface, text-muted, etc.)
 * - Charts/Libraries: Import hex values from this file
 * - Inline styles: Use cssVar() helper
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS - Hex values (sync with globals.css :root)
// ═══════════════════════════════════════════════════════════════════════════════

export const tokens = {
  // Background hierarchy
  background: {
    primary: '#0D1421', // Main app background
    secondary: '#131A2A', // Sections, header
    tertiary: '#171E2E', // Nested containers
  },

  // Surface hierarchy (cards, modals, dropdowns)
  surface: {
    default: '#1E2329', // Cards, modals
    hover: '#252B36', // Hover state
    elevated: '#2B3139', // Dropdowns, popovers
    border: '#2B3544', // All borders
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF', // Headings, important text
    secondary: '#A6B0C3', // Body text, labels
    muted: '#808A9D', // Captions, metadata
    disabled: '#5E6673', // Disabled state
  },

  // Brand colors
  brand: {
    primary: '#3861FB', // CMC blue - CTAs, links
    primaryHover: '#4A73FF',
    secondary: '#8DC647', // CoinGecko green
  },

  // Semantic colors
  semantic: {
    gain: '#16C784', // Positive change
    gainBg: 'rgba(22, 199, 132, 0.1)',
    loss: '#EA3943', // Negative change
    lossBg: 'rgba(234, 57, 67, 0.1)',
    warning: '#F7931A', // Bitcoin orange
    warningBg: 'rgba(247, 147, 26, 0.1)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.1)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// FLAT COLOR EXPORTS (for easy importing)
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Backgrounds
  bgPrimary: tokens.background.primary,
  bgSecondary: tokens.background.secondary,
  bgTertiary: tokens.background.tertiary,

  // Surfaces
  surface: tokens.surface.default,
  surfaceHover: tokens.surface.hover,
  surfaceElevated: tokens.surface.elevated,
  surfaceBorder: tokens.surface.border,

  // Text
  textPrimary: tokens.text.primary,
  textSecondary: tokens.text.secondary,
  textMuted: tokens.text.muted,
  textDisabled: tokens.text.disabled,

  // Brand
  primary: tokens.brand.primary,
  primaryHover: tokens.brand.primaryHover,
  secondary: tokens.brand.secondary,

  // Semantic
  gain: tokens.semantic.gain,
  gainBg: tokens.semantic.gainBg,
  loss: tokens.semantic.loss,
  lossBg: tokens.semantic.lossBg,
  warning: tokens.semantic.warning,
  warningBg: tokens.semantic.warningBg,
  info: tokens.semantic.info,
  infoBg: tokens.semantic.infoBg,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CSS VARIABLE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Get CSS variable reference for inline styles */
export function cssVar(name: keyof typeof cssVarMap): string {
  return `var(${cssVarMap[name]})`;
}

const cssVarMap = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  surface: '--surface',
  surfaceHover: '--surface-hover',
  surfaceElevated: '--surface-elevated',
  surfaceBorder: '--surface-border',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textDisabled: '--text-disabled',
  primary: '--primary',
  primaryHover: '--primary-hover',
  secondary: '--secondary',
  gain: '--gain',
  gainBg: '--gain-bg',
  loss: '--loss',
  lossBg: '--loss-bg',
  warning: '--warning',
  info: '--info',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CHART COLORS (for Recharts, Chart.js, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export const chartColors = {
  // Primary palette for multi-series
  palette: [
    tokens.brand.primary, // #3861FB - Blue
    tokens.semantic.gain, // #16C784 - Green
    tokens.semantic.warning, // #F7931A - Orange
    '#627EEA', // Ethereum purple
    tokens.semantic.loss, // #EA3943 - Red
    tokens.brand.secondary, // #8DC647 - Lime
    '#14B8A6', // Teal
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
  ],

  // Price movement
  gain: tokens.semantic.gain,
  loss: tokens.semantic.loss,
  neutral: tokens.text.muted,

  // Volume
  volumeGain: 'rgba(22, 199, 132, 0.3)',
  volumeLoss: 'rgba(234, 57, 67, 0.3)',

  // Grid & Axes
  grid: tokens.surface.border,
  axis: tokens.text.muted,

  // Tooltip
  tooltip: {
    background: tokens.surface.default,
    border: tokens.surface.border,
    text: tokens.text.primary,
    textSecondary: tokens.text.secondary,
  },

  // Area gradients [start, end]
  gradients: {
    gain: ['rgba(22, 199, 132, 0.4)', 'rgba(22, 199, 132, 0)'],
    loss: ['rgba(234, 57, 67, 0.4)', 'rgba(234, 57, 67, 0)'],
    primary: ['rgba(56, 97, 251, 0.4)', 'rgba(56, 97, 251, 0)'],
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO BRAND COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const cryptoBrands: Record<string, string> = {
  bitcoin: '#F7931A',
  btc: '#F7931A',
  ethereum: '#627EEA',
  eth: '#627EEA',
  tether: '#26A17B',
  usdt: '#26A17B',
  usdc: '#2775CA',
  bnb: '#F3BA2F',
  solana: '#9945FF',
  sol: '#9945FF',
  xrp: '#23292F',
  cardano: '#0033AD',
  ada: '#0033AD',
  avalanche: '#E84142',
  avax: '#E84142',
  dogecoin: '#C2A633',
  doge: '#C2A633',
  polkadot: '#E6007A',
  dot: '#E6007A',
  polygon: '#8247E5',
  matic: '#8247E5',
  chainlink: '#375BD2',
  link: '#375BD2',
  uniswap: '#FF007A',
  uni: '#FF007A',
  litecoin: '#BFBBBB',
  ltc: '#BFBBBB',
  cosmos: '#2E3148',
  atom: '#2E3148',
  near: '#00C08B',
  arbitrum: '#28A0F0',
  arb: '#28A0F0',
  optimism: '#FF0420',
  op: '#FF0420',
  base: '#0052FF',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAILWIND CLASS MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard Tailwind class combinations for common patterns.
 * Use these for consistency across components.
 */
export const tw = {
  // Backgrounds
  bgPrimary: 'bg-background',
  bgSecondary: 'bg-background-secondary',
  bgTertiary: 'bg-background-tertiary',

  // Surfaces
  surface: 'bg-surface',
  surfaceHover: 'bg-surface-hover',
  surfaceElevated: 'bg-surface-elevated',

  // Text
  textPrimary: 'text-text-primary',
  textSecondary: 'text-text-secondary',
  textMuted: 'text-text-muted',

  // Borders
  border: 'border-surface-border',

  // Semantic
  textGain: 'text-gain',
  textLoss: 'text-loss',
  bgGain: 'bg-gain-bg',
  bgLoss: 'bg-loss-bg',

  // Common component patterns
  card: 'bg-surface border border-surface-border rounded-xl',
  cardHover:
    'bg-surface border border-surface-border rounded-xl hover:bg-surface-hover hover:border-surface-hover transition-colors',
  input:
    'bg-background-secondary border border-surface-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary',
  button: {
    primary:
      'bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors',
    secondary:
      'bg-surface hover:bg-surface-hover text-text-primary border border-surface-border rounded-lg transition-colors',
    ghost:
      'hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-lg transition-colors',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Get color for price change direction */
export function getPriceColor(change: number): string {
  if (change > 0) return colors.gain;
  if (change < 0) return colors.loss;
  return colors.textMuted;
}

/** Get Tailwind class for price change direction */
export function getPriceClass(change: number): string {
  if (change > 0) return 'text-gain';
  if (change < 0) return 'text-loss';
  return 'text-text-muted';
}

/** Get background class for price change */
export function getPriceBgClass(change: number): string {
  if (change > 0) return 'bg-gain/10';
  if (change < 0) return 'bg-loss/10';
  return 'bg-surface';
}

/** Get crypto brand color by symbol or name */
export function getCryptoColor(identifier: string): string {
  const key = identifier.toLowerCase().replace(/\s+/g, '');
  return cryptoBrands[key] || colors.primary;
}

/** Format price change with sign and color class */
export function formatPriceChange(change: number): { text: string; class: string } {
  const sign = change > 0 ? '+' : '';
  return {
    text: `${sign}${change.toFixed(2)}%`,
    class: getPriceClass(change),
  };
}
