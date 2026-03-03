/**
 * Sperax MCP Server - Subgraph Tools
 *
 * Historical data queries via The Graph protocol.
 * Combines data from veSPA, SPA, and USDs subgraphs.
 */

import { z } from 'zod';

// ============================================================================
// Subgraph Endpoints
// ============================================================================

const SUBGRAPH_URLS = {
  VESPA: 'https://api.thegraph.com/subgraphs/name/sperax/vespa-arbitrum',
  SPA: 'https://api.thegraph.com/subgraphs/name/sperax/spa-arbitrum',
  USDS: 'https://api.thegraph.com/subgraphs/name/sperax/usds-arbitrum',
} as const;

// ============================================================================
// Input Schemas
// ============================================================================

const AddressInput = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to query history for'),
});

const TimeRangeInput = z.object({
  days: z
    .number()
    .min(1)
    .max(365)
    .default(30)
    .describe('Number of days of history to retrieve (1-365)'),
});

const PaginationInput = z.object({
  first: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe('Number of results to return'),
  skip: z
    .number()
    .min(0)
    .default(0)
    .describe('Number of results to skip'),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function querySubgraph(url: string, query: string): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph query failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`Subgraph error: ${result.errors[0]?.message || 'Unknown error'}`);
  }

  return result.data;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function getTimestampDaysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const subgraphTools = [
  {
    name: 'subgraph_vespa_lock_history',
    description:
      'Get historical veSPA lock events for an address. Shows when SPA was locked, amounts, and lock durations over time.',
    inputSchema: AddressInput.merge(PaginationInput),
    handler: async (input: z.infer<typeof AddressInput & typeof PaginationInput>) => {
      try {
        const query = `{
          lockEvents(
            where: { user: "${input.address.toLowerCase()}" }
            orderBy: timestamp
            orderDirection: desc
            first: ${input.first}
            skip: ${input.skip}
          ) {
            id
            user
            amount
            lockDuration
            timestamp
            transactionHash
          }
        }`;

        const data = await querySubgraph(SUBGRAPH_URLS.VESPA, query);

        const events = (data.lockEvents || []).map((e: any) => ({
          date: formatTimestamp(parseInt(e.timestamp)),
          amount: (parseFloat(e.amount) / 1e18).toFixed(2),
          lockDays: Math.floor(parseInt(e.lockDuration) / 86400),
          txHash: e.transactionHash,
        }));

        return {
          success: true,
          data: {
            address: input.address,
            lockEvents: events,
            totalEvents: events.length,
            summary: events.length > 0
              ? `Found ${events.length} lock events`
              : 'No veSPA lock history found',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to query veSPA history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'subgraph_vespa_voting_power_history',
    description:
      'Get historical voting power snapshots for veSPA. Shows how voting power has changed over time due to decay and additional locks.',
    inputSchema: AddressInput.merge(TimeRangeInput),
    handler: async (input: z.infer<typeof AddressInput & typeof TimeRangeInput>) => {
      try {
        const sinceTimestamp = getTimestampDaysAgo(input.days);

        const query = `{
          votingPowerSnapshots(
            where: { 
              user: "${input.address.toLowerCase()}"
              timestamp_gte: ${sinceTimestamp}
            }
            orderBy: timestamp
            orderDirection: asc
            first: 100
          ) {
            id
            user
            votingPower
            timestamp
          }
        }`;

        const data = await querySubgraph(SUBGRAPH_URLS.VESPA, query);

        const snapshots = (data.votingPowerSnapshots || []).map((s: any) => ({
          date: formatTimestamp(parseInt(s.timestamp)),
          votingPower: (parseFloat(s.votingPower) / 1e18).toFixed(2),
        }));

        // Calculate decay rate if we have enough data
        let decayInfo = null;
        if (snapshots.length >= 2) {
          const first = parseFloat(snapshots[0].votingPower);
          const last = parseFloat(snapshots[snapshots.length - 1].votingPower);
          const daysDiff = input.days;
          const dailyDecay = ((first - last) / first / daysDiff * 100).toFixed(4);
          decayInfo = {
            startPower: first.toFixed(2),
            endPower: last.toFixed(2),
            dailyDecayPercent: dailyDecay,
          };
        }

        return {
          success: true,
          data: {
            address: input.address,
            period: `Last ${input.days} days`,
            snapshots,
            decayAnalysis: decayInfo,
            tip: 'Voting power decays linearly as lock expiry approaches. Extend lock to maintain power.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to query voting power history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'subgraph_spa_transfer_history',
    description:
      'Get SPA token transfer history for an address. Shows inflows, outflows, and counterparties.',
    inputSchema: AddressInput.merge(PaginationInput),
    handler: async (input: z.infer<typeof AddressInput & typeof PaginationInput>) => {
      try {
        const addressLower = input.address.toLowerCase();

        const query = `{
          transfers(
            where: { 
              or: [
                { from: "${addressLower}" }
                { to: "${addressLower}" }
              ]
            }
            orderBy: timestamp
            orderDirection: desc
            first: ${input.first}
            skip: ${input.skip}
          ) {
            id
            from
            to
            amount
            timestamp
            transactionHash
          }
        }`;

        const data = await querySubgraph(SUBGRAPH_URLS.SPA, query);

        let totalIn = 0;
        let totalOut = 0;

        const transfers = (data.transfers || []).map((t: any) => {
          const amount = parseFloat(t.amount) / 1e18;
          const isIncoming = t.to.toLowerCase() === addressLower;
          
          if (isIncoming) totalIn += amount;
          else totalOut += amount;

          return {
            date: formatTimestamp(parseInt(t.timestamp)),
            type: isIncoming ? 'IN' : 'OUT',
            amount: amount.toFixed(2),
            counterparty: isIncoming ? t.from : t.to,
            txHash: t.transactionHash,
          };
        });

        return {
          success: true,
          data: {
            address: input.address,
            transfers,
            summary: {
              totalTransfers: transfers.length,
              totalInflow: totalIn.toFixed(2),
              totalOutflow: totalOut.toFixed(2),
              netFlow: (totalIn - totalOut).toFixed(2),
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to query SPA transfers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'subgraph_usds_rebase_history',
    description:
      'Get USDs rebase event history. Shows yield distribution events, amounts, and APR over time.',
    inputSchema: TimeRangeInput.merge(PaginationInput),
    handler: async (input: z.infer<typeof TimeRangeInput & typeof PaginationInput>) => {
      try {
        const sinceTimestamp = getTimestampDaysAgo(input.days);

        const query = `{
          rebaseEvents(
            where: { timestamp_gte: ${sinceTimestamp} }
            orderBy: timestamp
            orderDirection: desc
            first: ${input.first}
            skip: ${input.skip}
          ) {
            id
            rebaseAmount
            totalSupply
            rebasingSupply
            timestamp
            transactionHash
          }
        }`;

        const data = await querySubgraph(SUBGRAPH_URLS.USDS, query);

        const events = (data.rebaseEvents || []).map((e: any) => {
          const rebaseAmount = parseFloat(e.rebaseAmount) / 1e18;
          const rebasingSupply = parseFloat(e.rebasingSupply) / 1e18;
          const instantAPR = rebasingSupply > 0 
            ? (rebaseAmount / rebasingSupply * 365 * 100).toFixed(2)
            : '0';

          return {
            date: formatTimestamp(parseInt(e.timestamp)),
            rebaseAmount: rebaseAmount.toFixed(2),
            rebasingSupply: rebasingSupply.toFixed(0),
            instantAPR: `${instantAPR}%`,
            txHash: e.transactionHash,
          };
        });

        // Calculate average APR
        const aprs = events.map((e: any) => parseFloat(e.instantAPR));
        const avgAPR = aprs.length > 0 
          ? (aprs.reduce((a: number, b: number) => a + b, 0) / aprs.length).toFixed(2)
          : '0';

        return {
          success: true,
          data: {
            period: `Last ${input.days} days`,
            rebaseEvents: events,
            analytics: {
              totalRebases: events.length,
              averageAPR: `${avgAPR}%`,
              totalDistributed: events.reduce((sum: number, e: any) => sum + parseFloat(e.rebaseAmount), 0).toFixed(2),
            },
            description: 'USDs automatically rebases to distribute yield to opted-in holders',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to query rebase history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'subgraph_protocol_stats',
    description:
      'Get aggregated protocol statistics from all subgraphs. Overview of TVL, holders, and activity.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Query all subgraphs for aggregate stats
        const [vespaData, usdsData] = await Promise.all([
          querySubgraph(SUBGRAPH_URLS.VESPA, `{
            protocolStats(id: "1") {
              totalLocked
              uniqueLockers
              totalLockEvents
            }
          }`).catch(() => null),
          querySubgraph(SUBGRAPH_URLS.USDS, `{
            protocolStats(id: "1") {
              totalSupply
              rebasingSupply
              totalRebases
              totalYieldDistributed
            }
          }`).catch(() => null),
        ]);

        return {
          success: true,
          data: {
            vespa: vespaData?.protocolStats || {
              note: 'veSPA subgraph data unavailable',
            },
            usds: usdsData?.protocolStats || {
              note: 'USDs subgraph data unavailable',
            },
            sources: {
              vespa: SUBGRAPH_URLS.VESPA,
              spa: SUBGRAPH_URLS.SPA,
              usds: SUBGRAPH_URLS.USDS,
            },
            tip: 'Use individual subgraph tools for detailed historical queries',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to query protocol stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default subgraphTools;
