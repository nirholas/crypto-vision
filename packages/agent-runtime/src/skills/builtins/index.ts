/**
 * Built-in Skill Bundles
 *
 * Pre-packaged skill collections for common BNB Chain and EVM agent capabilities.
 * Import individual skill arrays or use the pre-configured bundles.
 */

import type { Skill, SkillBundle } from '../types.js';

import { defiSkills } from './defi.js';
import { tradingSkills } from './trading.js';
import { stakingSkills } from './staking.js';
import { bridgeSkills } from './bridge.js';
import { portfolioSkills } from './portfolio.js';
import { securitySkills } from './security.js';
import { walletSkills } from './wallet.js';
import { marketDataSkills } from './market-data.js';
import { governanceSkills } from './governance.js';
import { nftSkills } from './nft.js';

// ─── Re-exports ────────────────────────────────────────────────────

export { defiSkills } from './defi.js';
export { tradingSkills } from './trading.js';
export { stakingSkills } from './staking.js';
export { bridgeSkills } from './bridge.js';
export { portfolioSkills } from './portfolio.js';
export { securitySkills } from './security.js';
export { walletSkills } from './wallet.js';
export { marketDataSkills } from './market-data.js';
export { governanceSkills } from './governance.js';
export { nftSkills } from './nft.js';

// ─── Pre-configured Bundles ────────────────────────────────────────

/** All DeFi-related skills: swaps, lending, yield farming */
export const defiBundleSkills: SkillBundle = {
  name: 'defi',
  description: 'DeFi skills: token swaps, price quotes, lending, borrowing, and yield farming on PancakeSwap, Venus, and more.',
  skills: defiSkills,
};

/** Trading skills: limit orders, DCA, TWAP, price checks */
export const tradingBundleSkills: SkillBundle = {
  name: 'trading',
  description: 'Trading skills: limit orders, dollar-cost averaging, TWAP execution, and live price feeds.',
  skills: tradingSkills,
};

/** Staking skills: native BNB staking, liquid staking, validator info */
export const stakingBundleSkills: SkillBundle = {
  name: 'staking',
  description: 'Staking skills: BSC native staking, unstaking, liquid staking via Lista/Ankr, and staking info.',
  skills: stakingSkills,
};

/** Bridge skills: cross-chain transfers via Stargate/LayerZero */
export const bridgeBundleSkills: SkillBundle = {
  name: 'bridge',
  description: 'Cross-chain bridge skills: transfers, fee quotes, and transaction status tracking via Stargate/LayerZero.',
  skills: bridgeSkills,
};

/** Portfolio skills: balances, transaction history, approval audits */
export const portfolioBundleSkills: SkillBundle = {
  name: 'portfolio',
  description: 'Portfolio management skills: multi-token balances, transaction history, and ERC-20 approval auditing.',
  skills: portfolioSkills,
};

/** Security skills: token safety checks, contract audits, whale tracking */
export const securityBundleSkills: SkillBundle = {
  name: 'security',
  description: 'Security skills: token safety analysis, contract audit checks, and whale activity monitoring.',
  skills: securitySkills,
};

/** Wallet skills: send tokens, gas estimation, name resolution */
export const walletBundleSkills: SkillBundle = {
  name: 'wallet',
  description: 'Wallet skills: send BNB/tokens, gas estimation, and .bnb/.eth name resolution.',
  skills: walletSkills,
};

/** Market data skills: global overview, OHLCV, on-chain oracles, sentiment */
export const marketDataBundleSkills: SkillBundle = {
  name: 'market-data',
  description: 'Market data skills: global overview, OHLCV charts, Chainlink on-chain prices, and fear/greed index.',
  skills: marketDataSkills,
};

/** Governance skills: DAO voting, proposal info, delegation */
export const governanceBundleSkills: SkillBundle = {
  name: 'governance',
  description: 'Governance skills: cast votes, view proposal details, and delegate voting power on Governor contracts.',
  skills: governanceSkills,
};

/** NFT skills: transfer, metadata, collection info, approvals */
export const nftBundleSkills: SkillBundle = {
  name: 'nft',
  description: 'NFT skills: transfer, metadata lookup, collection info, and operator approval management.',
  skills: nftSkills,
};

// ─── Composite Bundles ─────────────────────────────────────────────

/** All available built-in skills combined */
export function getAllBuiltinSkills(): Skill[] {
  return [
    ...defiSkills,
    ...tradingSkills,
    ...stakingSkills,
    ...bridgeSkills,
    ...portfolioSkills,
    ...securitySkills,
    ...walletSkills,
    ...marketDataSkills,
    ...governanceSkills,
    ...nftSkills,
  ];
}

/** All built-in bundles */
export function getAllBuiltinBundles(): SkillBundle[] {
  return [
    defiBundleSkills,
    tradingBundleSkills,
    stakingBundleSkills,
    bridgeBundleSkills,
    portfolioBundleSkills,
    securityBundleSkills,
    walletBundleSkills,
    marketDataBundleSkills,
    governanceBundleSkills,
    nftBundleSkills,
  ];
}

/**
 * BNB Chain full bundle — all skills optimized for BSC ecosystem.
 * Includes DeFi, trading, staking, bridging, portfolio, security,
 * wallet, market data, governance, and NFT capabilities.
 */
export const bnbChainBundle: SkillBundle = {
  name: 'bnb-chain',
  description: 'Comprehensive BNB Chain agent skills: DeFi, trading, staking, bridging, portfolio management, security analysis, wallet operations, market data, governance, and NFTs.',
  skills: getAllBuiltinSkills(),
};
