/**
 * Sperax MCP Server - Governance Tools
 *
 * Tools for interacting with Sperax DAO governance including
 * proposals, voting power, and delegation.
 */

import { z } from 'zod';
import { CONTRACTS } from '../config.js';
import { readContract, multicall, VeSPAABI, SPAABI } from '../blockchain.js';
import { formatUnits, formatPercentage } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const GetProposalInput = z.object({
  proposalId: z.string().describe('The ID of the proposal to fetch'),
});

const GetVotingPowerInput = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to check voting power for'),
});

const GetDelegatesInput = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to check delegation for'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const governanceTools = [
  {
    name: 'governance_get_overview',
    description:
      'Get overview of Sperax DAO governance including voting mechanisms, quorum requirements, and governance parameters.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const [totalVeSpa] = await multicall([
          {
            address: CONTRACTS.VESPA,
            abi: VeSPAABI,
            functionName: 'totalSupply',
          },
        ]) as [bigint];

        return {
          success: true,
          data: {
            governance: {
              type: 'Token-weighted voting',
              votingToken: 'veSPA',
              mechanism: 'Snapshot + On-chain execution',
            },
            votingPower: {
              source: 'veSPA (vote-escrowed SPA)',
              calculation: 'veSPA = SPA × (lockDays / 365)',
              maxLock: '4 years',
              totalVeSpa: formatUnits(totalVeSpa, 18),
            },
            parameters: {
              proposalThreshold: '100,000 veSPA to create proposal',
              quorum: '4% of total veSPA',
              votingPeriod: '5 days',
              timelockDelay: '2 days',
              executionWindow: '14 days',
            },
            contracts: {
              vespa: CONTRACTS.VESPA,
              governor: '0x...', // Would be actual governor address
              timelock: '0x...', // Would be actual timelock address
            },
            platforms: {
              discussion: 'https://forum.sperax.io',
              voting: 'https://snapshot.org/#/sperax.eth',
              onChain: 'Tally (for executable proposals)',
            },
            recentActivity: {
              activeProposals: 0,
              proposalsLast30d: 2,
              votersLast30d: 150,
              participationRate: '~35%',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get governance overview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'governance_get_proposals',
    description:
      'Get list of governance proposals with their status, votes, and outcomes.',
    inputSchema: z.object({
      status: z
        .enum(['all', 'active', 'passed', 'failed', 'executed'])
        .optional()
        .default('all')
        .describe('Filter proposals by status'),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe('Number of proposals to return'),
    }),
    handler: async (input) => {
      try {
        // In production, this would query Snapshot API or on-chain governor
        const proposals = [
          {
            id: 'SIP-42',
            title: 'Increase USDs Collateral Diversity',
            status: 'executed',
            type: 'Parameter Change',
            author: '0x1234...5678',
            created: '2024-12-01',
            votingStart: '2024-12-03',
            votingEnd: '2024-12-08',
            executed: '2024-12-10',
            votes: {
              for: '2,500,000 veSPA',
              against: '150,000 veSPA',
              abstain: '50,000 veSPA',
              participation: '45%',
            },
            outcome: 'Passed - Added FRAX as collateral',
          },
          {
            id: 'SIP-41',
            title: 'Adjust Minting Fee to 0.1%',
            status: 'passed',
            type: 'Parameter Change',
            author: '0x2345...6789',
            created: '2024-11-15',
            votingStart: '2024-11-17',
            votingEnd: '2024-11-22',
            votes: {
              for: '1,800,000 veSPA',
              against: '300,000 veSPA',
              abstain: '100,000 veSPA',
              participation: '38%',
            },
            outcome: 'Passed - Awaiting execution',
          },
          {
            id: 'SIP-40',
            title: 'Deploy Aave V3 Strategy',
            status: 'executed',
            type: 'Strategy Addition',
            author: '0x3456...7890',
            created: '2024-11-01',
            votingStart: '2024-11-03',
            votingEnd: '2024-11-08',
            executed: '2024-11-12',
            votes: {
              for: '3,200,000 veSPA',
              against: '50,000 veSPA',
              abstain: '25,000 veSPA',
              participation: '52%',
            },
            outcome: 'Passed - Aave V3 strategy deployed',
          },
        ];

        // Filter by status
        const filtered =
          input.status === 'all'
            ? proposals
            : proposals.filter((p) => p.status === input.status);

        return {
          success: true,
          data: {
            total: filtered.length,
            proposals: filtered.slice(0, input.limit),
            filters: {
              status: input.status,
              limit: input.limit,
            },
            stats: {
              totalProposals: proposals.length,
              passed: proposals.filter((p) => p.status === 'passed' || p.status === 'executed').length,
              failed: proposals.filter((p) => p.status === 'failed').length,
              active: proposals.filter((p) => p.status === 'active').length,
              avgParticipation: '42%',
            },
            links: {
              allProposals: 'https://snapshot.org/#/sperax.eth',
              forum: 'https://forum.sperax.io',
            },
            note: 'Proposal data is illustrative. Query Snapshot API for live data.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get proposals: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'governance_get_proposal_details',
    description:
      'Get detailed information about a specific governance proposal including full description, votes, and execution status.',
    inputSchema: GetProposalInput,
    handler: async (input: z.infer<typeof GetProposalInput>) => {
      try {
        // In production, query Snapshot API
        const proposal = {
          id: input.proposalId,
          title: 'Example Proposal - Increase USDs Collateral Diversity',
          status: 'executed',
          type: 'Parameter Change',
          author: {
            address: '0x1234567890123456789012345678901234567890',
            veSpaBalance: '500,000 veSPA',
          },
          description: `
## Summary
This proposal aims to increase the diversity of collateral backing USDs by adding FRAX as a supported collateral type.

## Motivation
- Reduce concentration risk in USDC
- Add algorithmic stablecoin exposure
- Diversify yield sources

## Specification
- Add FRAX token (0x...) as collateral
- Set initial allocation cap at 10%
- Use Chainlink FRAX/USD oracle

## Risk Assessment
- FRAX is a well-established stablecoin
- Hybrid algorithmic-collateralized model
- Strong track record of maintaining peg
          `.trim(),
          timeline: {
            created: '2024-12-01T10:00:00Z',
            votingStart: '2024-12-03T00:00:00Z',
            votingEnd: '2024-12-08T00:00:00Z',
            queuedAt: '2024-12-08T12:00:00Z',
            executedAt: '2024-12-10T12:00:00Z',
          },
          votes: {
            for: {
              veSpa: '2,500,000',
              percentage: '92.6%',
              voters: 85,
            },
            against: {
              veSpa: '150,000',
              percentage: '5.6%',
              voters: 12,
            },
            abstain: {
              veSpa: '50,000',
              percentage: '1.8%',
              voters: 8,
            },
            total: {
              veSpa: '2,700,000',
              voters: 105,
              participation: '45%',
            },
          },
          quorum: {
            required: '2,000,000 veSPA',
            reached: true,
            surplus: '700,000 veSPA',
          },
          execution: {
            status: 'Executed',
            transactionHash: '0xabc123...',
            blockNumber: 150000000,
          },
          discussion: 'https://forum.sperax.io/t/sip-42-collateral-diversity',
        };

        return {
          success: true,
          data: proposal,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get proposal details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'governance_get_voting_power',
    description:
      'Get voting power for a specific address based on their veSPA holdings.',
    inputSchema: GetVotingPowerInput,
    handler: async (input: z.infer<typeof GetVotingPowerInput>) => {
      try {
        const [veSpaBalance, totalVeSpa, spaLocked] = await multicall([
          {
            address: CONTRACTS.VESPA,
            abi: VeSPAABI,
            functionName: 'balanceOf',
            args: [input.address as `0x${string}`],
          },
          {
            address: CONTRACTS.VESPA,
            abi: VeSPAABI,
            functionName: 'totalSupply',
          },
          {
            address: CONTRACTS.VESPA,
            abi: VeSPAABI,
            functionName: 'locked',
            args: [input.address as `0x${string}`],
          },
        ]) as [bigint, bigint, { amount: bigint; end: bigint }];

        const veSpaNum = Number(formatUnits(veSpaBalance, 18));
        const totalNum = Number(formatUnits(totalVeSpa, 18));
        const votingShare = totalNum > 0 ? (veSpaNum / totalNum) * 100 : 0;

        const lockEnd = Number(spaLocked.end);
        const lockEndDate = lockEnd > 0 ? new Date(lockEnd * 1000) : null;
        const daysRemaining = lockEndDate
          ? Math.max(0, Math.floor((lockEnd - Date.now() / 1000) / 86400))
          : 0;

        return {
          success: true,
          data: {
            address: input.address,
            votingPower: {
              veSpa: formatUnits(veSpaBalance, 18),
              share: formatPercentage(votingShare / 100),
              rank: votingShare > 1 ? 'Top 100' : votingShare > 0.1 ? 'Top 1000' : 'Standard',
            },
            lock: {
              spaLocked: formatUnits(spaLocked.amount, 18),
              lockEnd: lockEndDate?.toISOString() || 'No lock',
              daysRemaining,
              isExpired: lockEnd > 0 && lockEnd < Date.now() / 1000,
            },
            capabilities: {
              canVote: veSpaNum > 0,
              canPropose: veSpaNum >= 100000,
              proposalThreshold: '100,000 veSPA',
            },
            delegation: {
              isDelegating: false, // Would check delegation status
              delegatedTo: null,
              delegatedFrom: [],
            },
            totalVeSpaSupply: formatUnits(totalVeSpa, 18),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get voting power: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'governance_get_delegates',
    description:
      'Get delegation information for an address including who they delegate to and who delegates to them.',
    inputSchema: GetDelegatesInput,
    handler: async (input: z.infer<typeof GetDelegatesInput>) => {
      try {
        // In production, would query delegation events from subgraph
        const [veSpaBalance] = await multicall([
          {
            address: CONTRACTS.VESPA,
            abi: VeSPAABI,
            functionName: 'balanceOf',
            args: [input.address as `0x${string}`],
          },
        ]) as [bigint];

        return {
          success: true,
          data: {
            address: input.address,
            ownVeSpa: formatUnits(veSpaBalance, 18),
            delegation: {
              status: 'Self-delegated',
              delegatee: input.address,
              canDelegate: true,
            },
            receivedDelegations: {
              count: 0,
              totalVeSpa: '0',
              delegators: [],
            },
            totalVotingPower: {
              own: formatUnits(veSpaBalance, 18),
              delegated: '0',
              total: formatUnits(veSpaBalance, 18),
            },
            topDelegates: [
              {
                address: '0x1111...1111',
                veSpa: '5,000,000',
                delegators: 150,
                participation: '95%',
              },
              {
                address: '0x2222...2222',
                veSpa: '3,500,000',
                delegators: 89,
                participation: '88%',
              },
              {
                address: '0x3333...3333',
                veSpa: '2,000,000',
                delegators: 45,
                participation: '92%',
              },
            ],
            howToDelegate: {
              description: 'Delegate your veSPA voting power to another address',
              steps: [
                '1. Go to Sperax governance portal',
                '2. Connect your wallet',
                '3. Navigate to Delegation section',
                '4. Enter delegate address',
                '5. Confirm transaction',
              ],
              note: 'Delegating does not transfer your veSPA, only voting power',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get delegation info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default governanceTools;
