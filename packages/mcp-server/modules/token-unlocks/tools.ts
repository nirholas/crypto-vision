/**
 * Token Unlock & Vesting Schedule MCP Tools
 * 
 * MCP server tools for tracking token unlocks, vesting schedules,
 * and analyzing their potential market impact.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createUnlockTracker, type UnlockTracker } from './tracker.js';
import type {
  TokenProject,
  VestingSchedule,
  UnlockSearchFilters,
} from './types.js';
import { formatTokenAmount } from './calculator.js';

// Global tracker instance
let tracker: UnlockTracker | null = null;

/**
 * Get or create tracker instance
 */
function getTracker(): UnlockTracker {
  if (!tracker) {
    tracker = createUnlockTracker();
    
    // Initialize with some example data
    initializeExampleData(tracker);
  }
  return tracker;
}

/**
 * Initialize with example data for demonstration
 */
function initializeExampleData(tracker: UnlockTracker): void {
  // Example: Arbitrum ARB token
  const arbProject: TokenProject = {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ARB',
    chain: 'arbitrum',
    tokenAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    totalSupply: '10000000000',
    circulatingSupply: '1275000000',
    marketCap: '1500000000',
    currentPrice: '1.18',
    launchDate: new Date('2023-03-23'),
  };
  
  tracker.addProject(arbProject);
  
  // Add vesting schedules
  const teamSchedule: VestingSchedule = {
    id: 'arb-team',
    projectId: 'arbitrum',
    beneficiaryType: 'team',
    totalTokens: '1762800000',
    cliffDuration: 365,
    cliffEnd: new Date('2024-03-23'),
    vestingDuration: 1461, // 4 years
    vestingStart: new Date('2023-03-23'),
    vestingEnd: new Date('2027-03-23'),
    initialUnlock: '0',
    linearVesting: true,
  };
  
  const investorSchedule: VestingSchedule = {
    id: 'arb-investors',
    projectId: 'arbitrum',
    beneficiaryType: 'investors',
    totalTokens: '1750000000',
    cliffDuration: 365,
    cliffEnd: new Date('2024-03-23'),
    vestingDuration: 1461,
    vestingStart: new Date('2023-03-23'),
    vestingEnd: new Date('2027-03-23'),
    initialUnlock: '0',
    linearVesting: true,
  };
  
  tracker.addVestingSchedule(teamSchedule);
  tracker.addVestingSchedule(investorSchedule);
}

/**
 * Register all token unlock tools with the MCP server
 */
export function registerUnlockTools(server: McpServer): void {
  // Tool: Add project to track
  server.tool(
    'unlock_add_project',
    'Add a new token project to track for unlock events',
    {
      id: z.string().describe('Unique project identifier'),
      name: z.string().describe('Project name'),
      symbol: z.string().describe('Token symbol'),
      chain: z.string().describe('Blockchain network'),
      tokenAddress: z.string().describe('Token contract address'),
      totalSupply: z.string().describe('Total token supply'),
      circulatingSupply: z.string().describe('Current circulating supply'),
      marketCap: z.string().optional().describe('Market capitalization in USD'),
      currentPrice: z.string().optional().describe('Current token price in USD'),
      launchDate: z.string().describe('Token launch date (ISO format)'),
    },
    async (args) => {
      const tracker = getTracker();
      
      const project: TokenProject = {
        ...args,
        launchDate: new Date(args.launchDate),
      };
      
      tracker.addProject(project);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Added ${project.name} (${project.symbol}) to tracker`,
            project,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Add vesting schedule
  server.tool(
    'unlock_add_schedule',
    'Add a vesting schedule for a tracked project',
    {
      projectId: z.string().describe('Project ID this schedule belongs to'),
      beneficiaryType: z.enum(['team', 'investors', 'advisors', 'foundation', 'ecosystem', 'community', 'partners'])
        .describe('Type of beneficiary'),
      totalTokens: z.string().describe('Total tokens in this schedule'),
      cliffDuration: z.number().describe('Cliff duration in days'),
      vestingDuration: z.number().describe('Total vesting duration in days'),
      vestingStart: z.string().describe('Vesting start date (ISO format)'),
      initialUnlock: z.string().default('0').describe('Tokens unlocked at TGE'),
    },
    async (args) => {
      const tracker = getTracker();
      
      const vestingStart = new Date(args.vestingStart);
      const cliffEnd = new Date(vestingStart);
      cliffEnd.setDate(cliffEnd.getDate() + args.cliffDuration);
      
      const vestingEnd = new Date(vestingStart);
      vestingEnd.setDate(vestingEnd.getDate() + args.vestingDuration);
      
      const schedule: VestingSchedule = {
        id: `${args.projectId}-${args.beneficiaryType}-${Date.now()}`,
        projectId: args.projectId,
        beneficiaryType: args.beneficiaryType,
        totalTokens: args.totalTokens,
        cliffDuration: args.cliffDuration,
        cliffEnd: args.cliffDuration > 0 ? cliffEnd : null,
        vestingDuration: args.vestingDuration,
        vestingStart,
        vestingEnd,
        initialUnlock: args.initialUnlock,
        linearVesting: true,
      };
      
      tracker.addVestingSchedule(schedule);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Added ${args.beneficiaryType} vesting schedule`,
            schedule,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get upcoming unlocks
  server.tool(
    'unlock_get_upcoming',
    'Get upcoming token unlock events for a project',
    {
      projectId: z.string().describe('Project ID to query'),
      limit: z.number().optional().describe('Maximum number of events to return'),
    },
    async (args) => {
      const tracker = getTracker();
      const project = tracker.getProject(args.projectId);
      
      if (!project) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Project ${args.projectId} not found`,
            }, null, 2),
          }],
        };
      }
      
      const unlocks = tracker.getUpcomingUnlocks(args.projectId, args.limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project: {
              name: project.name,
              symbol: project.symbol,
            },
            upcomingUnlocks: unlocks.map(u => ({
              date: u.date.toISOString(),
              tokensUnlocked: formatTokenAmount(u.tokensUnlocked),
              percentageOfCirculating: `${u.percentageOfCirculating.toFixed(2)}%`,
              beneficiaryType: u.beneficiaryType,
              isCliffEvent: u.isCliffEvent,
              daysUntil: Math.ceil((u.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            })),
            totalEvents: unlocks.length,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get unlock calendar
  server.tool(
    'unlock_get_calendar',
    'Get unlock events calendar for a date range across all projects',
    {
      startDate: z.string().describe('Start date (ISO format)'),
      endDate: z.string().describe('End date (ISO format)'),
    },
    async (args) => {
      const tracker = getTracker();
      const calendar = tracker.getUnlockCalendar(
        new Date(args.startDate),
        new Date(args.endDate)
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            calendar: calendar.map(day => ({
              date: day.date.toISOString().split('T')[0],
              eventsCount: day.events.length,
              projectsAffected: day.projectsAffected,
              totalValueUnlocked: day.totalValueUnlocked,
              events: day.events.map(e => {
                const project = tracker.getProject(e.projectId);
                return {
                  project: project?.name,
                  symbol: project?.symbol,
                  tokensUnlocked: formatTokenAmount(e.tokensUnlocked),
                  beneficiaryType: e.beneficiaryType,
                  isCliffEvent: e.isCliffEvent,
                };
              }),
            })),
            totalDays: calendar.length,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get market impact analysis
  server.tool(
    'unlock_market_impact',
    'Analyze potential market impact of upcoming unlocks for a project',
    {
      projectId: z.string().describe('Project ID to analyze'),
    },
    async (args) => {
      const tracker = getTracker();
      const project = tracker.getProject(args.projectId);
      
      if (!project) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Project ${args.projectId} not found`,
            }, null, 2),
          }],
        };
      }
      
      const analyses = tracker.getMarketImpactAnalysis(args.projectId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project: {
              name: project.name,
              symbol: project.symbol,
            },
            analyses: analyses.map(a => ({
              date: a.unlockEvent.date.toISOString(),
              riskLevel: a.riskLevel,
              impactScore: a.impactScore,
              tokensUnlocked: formatTokenAmount(a.unlockEvent.tokensUnlocked),
              percentageOfCirculating: `${a.unlockEvent.percentageOfCirculating.toFixed(2)}%`,
              beneficiaryType: a.unlockEvent.beneficiaryType,
              factors: {
                unlockSize: `${a.factors.unlockSize.toFixed(2)}%`,
                hodlProbability: `${a.factors.hodlProbability}%`,
                liquidityRatio: a.factors.liquidityRatio,
                marketSentiment: a.factors.marketSentiment,
              },
              estimatedPriceImpact: a.estimatedPriceImpact,
              recommendations: a.recommendations,
            })),
            totalAnalyses: analyses.length,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Search unlocks
  server.tool(
    'unlock_search',
    'Search for unlock events with filters',
    {
      startDate: z.string().optional().describe('Filter by start date'),
      endDate: z.string().optional().describe('Filter by end date'),
      beneficiaryTypes: z.array(z.string()).optional().describe('Filter by beneficiary types'),
      projectIds: z.array(z.string()).optional().describe('Filter by project IDs'),
      chains: z.array(z.string()).optional().describe('Filter by blockchain networks'),
      riskLevels: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional()
        .describe('Filter by risk levels'),
    },
    async (args) => {
      const tracker = getTracker();
      
      const filters: UnlockSearchFilters = {
        startDate: args.startDate ? new Date(args.startDate) : undefined,
        endDate: args.endDate ? new Date(args.endDate) : undefined,
        beneficiaryTypes: args.beneficiaryTypes,
        projectIds: args.projectIds,
        chains: args.chains,
        riskLevels: args.riskLevels,
      };
      
      const results = tracker.searchUnlocks(filters);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results: results.slice(0, 50).map(event => {
              const project = tracker.getProject(event.projectId);
              return {
                project: project?.name,
                symbol: project?.symbol,
                date: event.date.toISOString(),
                tokensUnlocked: formatTokenAmount(event.tokensUnlocked),
                percentageOfCirculating: `${event.percentageOfCirculating.toFixed(2)}%`,
                beneficiaryType: event.beneficiaryType,
                isCliffEvent: event.isCliffEvent,
              };
            }),
            totalResults: results.length,
            filters: args,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get vesting analytics
  server.tool(
    'unlock_vesting_analytics',
    'Get comprehensive vesting analytics for a project',
    {
      projectId: z.string().describe('Project ID to analyze'),
    },
    async (args) => {
      const tracker = getTracker();
      const analytics = tracker.getVestingAnalytics(args.projectId);
      
      if (!analytics) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Project ${args.projectId} not found`,
            }, null, 2),
          }],
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project: {
              name: analytics.project.name,
              symbol: analytics.project.symbol,
              totalSupply: formatTokenAmount(analytics.project.totalSupply),
              circulatingSupply: formatTokenAmount(analytics.project.circulatingSupply),
            },
            statistics: {
              totalVested: formatTokenAmount(analytics.statistics.totalVested),
              totalUnlocked: formatTokenAmount(analytics.statistics.totalUnlocked),
              percentageVested: `${analytics.statistics.percentageVested.toFixed(2)}%`,
              nextUnlockDate: analytics.statistics.nextUnlockDate?.toISOString(),
              nextUnlockAmount: formatTokenAmount(analytics.statistics.nextUnlockAmount),
              unlockFrequency: analytics.statistics.unlockFrequency,
              fullyUnlockedDate: analytics.fullyUnlockedDate.toISOString(),
            },
            upcomingUnlocks: analytics.upcomingUnlocks.length,
            teamTokensRemaining: formatTokenAmount(analytics.teamTokensRemaining),
            investorTokensRemaining: formatTokenAmount(analytics.investorTokensRemaining),
            highRiskUnlocks: analytics.marketImpact.filter(a => 
              a.riskLevel === 'high' || a.riskLevel === 'critical'
            ).length,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get alerts
  server.tool(
    'unlock_get_alerts',
    'Get active vesting unlock alerts',
    {
      includeAcknowledged: z.boolean().default(false)
        .describe('Include acknowledged alerts'),
    },
    async (args) => {
      const tracker = getTracker();
      const alerts = tracker.getAlerts(args.includeAcknowledged);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            alerts: alerts.map(alert => {
              const project = tracker.getProject(alert.projectId);
              return {
                id: alert.id,
                project: project?.name,
                type: alert.alertType,
                severity: alert.severity,
                message: alert.message,
                daysUntil: alert.daysUntil,
                acknowledged: alert.acknowledged,
                createdAt: alert.createdAt.toISOString(),
              };
            }),
            totalAlerts: alerts.length,
            criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: List tracked projects
  server.tool(
    'unlock_list_projects',
    'List all tracked token projects',
    {},
    async () => {
      const tracker = getTracker();
      const projects = tracker.getAllProjects();
      const stats = tracker.getTrackerStats();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              symbol: p.symbol,
              chain: p.chain,
              totalSupply: formatTokenAmount(p.totalSupply),
              circulatingSupply: formatTokenAmount(p.circulatingSupply),
              marketCap: p.marketCap,
              currentPrice: p.currentPrice,
            })),
            stats,
          }, null, 2),
        }],
      };
    }
  );

  // Tool: Get tracker statistics
  server.tool(
    'unlock_tracker_stats',
    'Get overall tracker statistics and summary',
    {},
    async () => {
      const tracker = getTracker();
      const stats = tracker.getTrackerStats();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            stats: {
              totalProjects: stats.totalProjects,
              totalSchedules: stats.totalSchedules,
              upcomingUnlocks: stats.upcomingUnlocks,
              criticalAlerts: stats.criticalAlerts,
              nextMajorUnlock: stats.nextMajorUnlock ? {
                project: stats.nextMajorUnlock.project,
                date: stats.nextMajorUnlock.date.toISOString(),
                amount: formatTokenAmount(stats.nextMajorUnlock.amount),
              } : null,
            },
          }, null, 2),
        }],
      };
    }
  );
}
