/**
 * Agent Skills Module
 *
 * Composable, discoverable skill framework for ERC-8004 agents.
 * Skills provide structured capabilities that agents can register,
 * advertise via agent cards, and execute via A2A messaging.
 *
 * @example
 * ```typescript
 * import { ERC8004Agent } from '@nirholas/erc8004-agent-runtime';
 * import { bnbChainBundle } from '@nirholas/erc8004-agent-runtime/skills';
 *
 * const agent = new ERC8004Agent({ name: 'DeFi Agent', ... });
 * agent.addSkillBundle(bnbChainBundle);
 * await agent.start();
 * ```
 */

// ─── Core Types ────────────────────────────────────────────────────

export type {
  SkillCategory,
  SkillParameterSchema,
  SkillDefinition,
  SkillResult,
  SkillContext,
  SkillHandler,
  Skill,
  SkillBundle,
  SkillFilter,
  SkillRegistryStats,
} from './types.js';

// ─── Registry ──────────────────────────────────────────────────────

export { SkillRegistry } from './registry.js';

// ─── Built-in Skills ───────────────────────────────────────────────

export {
  // Individual skill arrays
  defiSkills,
  tradingSkills,
  stakingSkills,
  bridgeSkills,
  portfolioSkills,
  securitySkills,
  walletSkills,
  marketDataSkills,
  governanceSkills,
  nftSkills,
  // Pre-configured bundles
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
  // Composite bundles
  bnbChainBundle,
  // Helper functions
  getAllBuiltinSkills,
  getAllBuiltinBundles,
} from './builtins/index.js';
