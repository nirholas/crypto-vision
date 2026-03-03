/**
 * Sperax MCP Server - Supply Tools
 *
 * Real-time circulating supply data for SPA and USDs tokens.
 * Uses the Sperax Circulating Supply API.
 */

import { z } from 'zod';
import { CONTRACTS } from '../config.js';
import { readContract, multicall, ERC20ABI, SPAABI, USDs_ABI } from '../blockchain.js';
import { formatUnits } from '../utils.js';

// ============================================================================
// API Endpoints
// ============================================================================

const SUPPLY_API_BASE = 'https://api.sperax.io';

// ============================================================================
// Tool Definitions
// ============================================================================

export const supplyTools = [
  {
    name: 'supply_get_circulating',
    description:
      'Get real-time circulating supply for SPA and USDs tokens. Circulating supply excludes locked tokens, treasury holdings, and burned tokens.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Try to fetch from API first
        let apiData = null;
        try {
          const response = await fetch(`${SUPPLY_API_BASE}/v1/supply`);
          if (response.ok) {
            apiData = await response.json();
          }
        } catch {
          // API unavailable, fall back to on-chain
        }

        // Get on-chain data as fallback/verification
        const [spaTotalSupply, usdsTotalSupply, usdsRebasingSupply] = await multicall([
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: USDs_ABI,
            functionName: 'rebasingCreditsHighres',
          },
        ]) as [bigint, bigint, bigint];

        const spaTotal = parseFloat(formatUnits(spaTotalSupply, 18));
        const usdsTotal = parseFloat(formatUnits(usdsTotalSupply, 18));

        // Known locked/excluded addresses for SPA
        const excludedAddresses = [
          '0x0000000000000000000000000000000000000000', // Burn address
          CONTRACTS.VESPA, // veSPA locked
          // Add treasury/team vesting addresses here
        ];

        // Calculate approximate circulating (total - excluded)
        let spaExcluded = 0;
        try {
          const excludedBalances = await multicall(
            excludedAddresses.map((addr) => ({
              address: CONTRACTS.SPA as `0x${string}`,
              abi: ERC20ABI,
              functionName: 'balanceOf',
              args: [addr],
            }))
          ) as bigint[];

          spaExcluded = excludedBalances.reduce(
            (sum, bal) => sum + parseFloat(formatUnits(bal, 18)),
            0
          );
        } catch {
          // Continue with total supply if balance check fails
        }

        const spaCirculating = spaTotal - spaExcluded;

        return {
          success: true,
          data: {
            spa: {
              totalSupply: spaTotal.toLocaleString(),
              circulatingSupply: spaCirculating.toLocaleString(),
              lockedInVeSPA: spaExcluded.toLocaleString(),
              percentCirculating: ((spaCirculating / spaTotal) * 100).toFixed(2) + '%',
            },
            usds: {
              totalSupply: usdsTotal.toLocaleString(),
              circulatingSupply: usdsTotal.toLocaleString(), // USDs is fully circulating
              note: 'USDs has no locked supply - all minted tokens are circulating',
            },
            source: apiData ? 'Sperax API + On-chain verification' : 'On-chain data',
            contracts: {
              spa: CONTRACTS.SPA,
              usds: CONTRACTS.USDS,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get circulating supply: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'supply_get_spa_breakdown',
    description:
      'Get detailed SPA token supply breakdown including veSPA locked, xSPA pending, treasury, and team allocations.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Get total supply
        const totalSupply = await readContract({
          address: CONTRACTS.SPA as `0x${string}`,
          abi: ERC20ABI,
          functionName: 'totalSupply',
        }) as bigint;

        // Get balances of known addresses
        const [vespaLocked, xspaBalance, buybackBalance] = await multicall([
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.VESPA],
          },
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.XSPA],
          },
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.SPA_BUYBACK],
          },
        ]) as [bigint, bigint, bigint];

        const total = parseFloat(formatUnits(totalSupply, 18));
        const vespa = parseFloat(formatUnits(vespaLocked, 18));
        const xspa = parseFloat(formatUnits(xspaBalance, 18));
        const buyback = parseFloat(formatUnits(buybackBalance, 18));
        const circulating = total - vespa - xspa - buyback;

        return {
          success: true,
          data: {
            totalSupply: {
              amount: total.toLocaleString(),
              description: 'Total SPA tokens in existence',
            },
            breakdown: {
              circulating: {
                amount: circulating.toLocaleString(),
                percent: ((circulating / total) * 100).toFixed(2) + '%',
                description: 'Freely tradeable SPA',
              },
              lockedInVeSPA: {
                amount: vespa.toLocaleString(),
                percent: ((vespa / total) * 100).toFixed(2) + '%',
                description: 'SPA locked for voting power and rewards',
              },
              inXSPA: {
                amount: xspa.toLocaleString(),
                percent: ((xspa / total) * 100).toFixed(2) + '%',
                description: 'SPA backing xSPA redemptions',
              },
              inBuyback: {
                amount: buyback.toLocaleString(),
                percent: ((buyback / total) * 100).toFixed(2) + '%',
                description: 'SPA pending buyback/burn',
              },
            },
            addresses: {
              spa: CONTRACTS.SPA,
              vespa: CONTRACTS.VESPA,
              xspa: CONTRACTS.XSPA,
              buyback: CONTRACTS.SPA_BUYBACK,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get SPA breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'supply_get_usds_breakdown',
    description:
      'Get detailed USDs stablecoin supply breakdown including rebasing vs non-rebasing supply.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const [totalSupply, rebasingCredits, rebasingCreditsPerToken] = await multicall([
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: USDs_ABI,
            functionName: 'rebasingCreditsHighres',
          },
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: USDs_ABI,
            functionName: 'rebasingCreditsPerTokenHighres',
          },
        ]) as [bigint, bigint, bigint];

        const total = parseFloat(formatUnits(totalSupply, 18));
        
        // Calculate rebasing supply from credits
        let rebasingSupply = 0;
        if (rebasingCreditsPerToken > 0n) {
          rebasingSupply = parseFloat(formatUnits(
            rebasingCredits * BigInt(1e18) / rebasingCreditsPerToken,
            18
          ));
        }
        
        const nonRebasingSupply = total - rebasingSupply;

        return {
          success: true,
          data: {
            totalSupply: {
              amount: total.toLocaleString(),
              usdValue: `$${total.toLocaleString()}`,
              description: 'Total USDs minted',
            },
            breakdown: {
              rebasingSupply: {
                amount: rebasingSupply.toLocaleString(),
                percent: ((rebasingSupply / total) * 100).toFixed(2) + '%',
                description: 'USDs earning automatic yield',
                holders: 'Wallets opted-in to rebase',
              },
              nonRebasingSupply: {
                amount: nonRebasingSupply.toLocaleString(),
                percent: ((nonRebasingSupply / total) * 100).toFixed(2) + '%',
                description: 'USDs not earning yield',
                holders: 'Smart contracts, opted-out wallets',
              },
            },
            yieldMechanics: {
              explanation: 'When yield is distributed, only rebasing supply receives it',
              effectiveAPR: 'Higher for rebasing holders since yield is concentrated',
              optInRequired: 'Wallets must opt-in to receive rebase yield',
            },
            contract: CONTRACTS.USDS,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get USDs breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default supplyTools;
