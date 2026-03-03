/**
 * Token Unlock & Vesting Schedule Tracker
 * 
 * Main tracker class for managing token unlock data,
 * generating alerts, and providing calendar views.
 */

import type {
  TokenProject,
  VestingSchedule,
  UnlockEvent,
  MarketImpactAnalysis,
  VestingAlert,
  UnlockCalendar,
  VestingStatistics,
  TrackerConfig,
  UnlockSearchFilters,
  VestingAnalytics,
} from './types.js';
import {
  calculateUnlockEvents,
  analyzeMarketImpact,
  calculateVestingStatistics,
  daysUntilUnlock,
} from './calculator.js';

/**
 * Default tracker configuration
 */
const DEFAULT_CONFIG: TrackerConfig = {
  alertThresholds: {
    minUnlockPercentage: 5, // alert if unlock > 5% of supply
    daysBeforeAlert: 7, // alert 7 days before
    minMarketCapForAlert: 10_000_000, // $10M minimum
  },
  priceDataSource: 'coingecko',
  refreshInterval: 60, // 60 minutes
  enableNotifications: true,
};

/**
 * Token Unlock Tracker
 */
export class UnlockTracker {
  private projects: Map<string, TokenProject> = new Map();
  private schedules: Map<string, VestingSchedule[]> = new Map();
  private unlockEvents: Map<string, UnlockEvent[]> = new Map();
  private alerts: VestingAlert[] = [];
  private config: TrackerConfig;

  constructor(config?: Partial<TrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a project to track
   */
  addProject(project: TokenProject): void {
    this.projects.set(project.id, project);
    this.schedules.set(project.id, []);
    this.unlockEvents.set(project.id, []);
  }

  /**
   * Add vesting schedule for a project
   */
  addVestingSchedule(schedule: VestingSchedule): void {
    const schedules = this.schedules.get(schedule.projectId) || [];
    schedules.push(schedule);
    this.schedules.set(schedule.projectId, schedules);

    // Calculate unlock events from schedule
    const events = calculateUnlockEvents(schedule);
    const existingEvents = this.unlockEvents.get(schedule.projectId) || [];
    this.unlockEvents.set(schedule.projectId, [...existingEvents, ...events]);

    // Generate alerts for new schedule
    this.generateAlertsForSchedule(schedule, events);
  }

  /**
   * Get project by ID
   */
  getProject(projectId: string): TokenProject | undefined {
    return this.projects.get(projectId);
  }

  /**
   * Get all tracked projects
   */
  getAllProjects(): TokenProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get vesting schedules for a project
   */
  getVestingSchedules(projectId: string): VestingSchedule[] {
    return this.schedules.get(projectId) || [];
  }

  /**
   * Get upcoming unlock events for a project
   */
  getUpcomingUnlocks(projectId: string, limit?: number): UnlockEvent[] {
    const events = this.unlockEvents.get(projectId) || [];
    const now = new Date();
    const upcoming = events
      .filter(e => e.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return limit ? upcoming.slice(0, limit) : upcoming;
  }

  /**
   * Get historical unlock events for a project
   */
  getHistoricalUnlocks(projectId: string, limit?: number): UnlockEvent[] {
    const events = this.unlockEvents.get(projectId) || [];
    const now = new Date();
    const historical = events
      .filter(e => e.date <= now)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return limit ? historical.slice(0, limit) : historical;
  }

  /**
   * Get unlock calendar for date range
   */
  getUnlockCalendar(startDate: Date, endDate: Date): UnlockCalendar[] {
    const calendar: Map<string, UnlockCalendar> = new Map();

    // Collect all events in date range
    this.unlockEvents.forEach(events => {
      events
        .filter(e => e.date >= startDate && e.date <= endDate)
        .forEach(event => {
          const dateKey = event.date.toISOString().split('T')[0];
          
          if (!calendar.has(dateKey)) {
            calendar.set(dateKey, {
              date: new Date(dateKey),
              events: [],
              totalValueUnlocked: '0',
              projectsAffected: 0,
            });
          }

          const day = calendar.get(dateKey)!;
          day.events.push(event);
          
          // Calculate total value if price available
          const project = this.projects.get(event.projectId);
          if (project?.currentPrice && event.estimatedValue) {
            const currentTotal = parseFloat(day.totalValueUnlocked);
            const eventValue = parseFloat(event.estimatedValue);
            day.totalValueUnlocked = (currentTotal + eventValue).toString();
          }
        });
    });

    // Count unique projects per day
    calendar.forEach((day) => {
      const uniqueProjects = new Set(day.events.map(e => e.projectId));
      day.projectsAffected = uniqueProjects.size;
    });

    return Array.from(calendar.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Search unlock events with filters
   */
  searchUnlocks(filters: UnlockSearchFilters): UnlockEvent[] {
    let results: UnlockEvent[] = [];

    // Collect all events
    this.unlockEvents.forEach((events, projectId) => {
      const project = this.projects.get(projectId);
      if (!project) return;

      let filtered = events;

      // Apply date filters
      if (filters.startDate) {
        filtered = filtered.filter(e => e.date >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(e => e.date <= filters.endDate!);
      }

      // Apply token amount filters
      if (filters.minTokensUnlocked) {
        filtered = filtered.filter(e => 
          parseFloat(e.tokensUnlocked) >= parseFloat(filters.minTokensUnlocked!)
        );
      }
      if (filters.maxTokensUnlocked) {
        filtered = filtered.filter(e => 
          parseFloat(e.tokensUnlocked) <= parseFloat(filters.maxTokensUnlocked!)
        );
      }

      // Apply beneficiary type filter
      if (filters.beneficiaryTypes && filters.beneficiaryTypes.length > 0) {
        filtered = filtered.filter(e => 
          filters.beneficiaryTypes!.includes(e.beneficiaryType)
        );
      }

      // Apply project filter
      if (filters.projectIds && filters.projectIds.length > 0) {
        if (!filters.projectIds.includes(projectId)) {
          return;
        }
      }

      // Apply chain filter
      if (filters.chains && filters.chains.length > 0) {
        if (!filters.chains.includes(project.chain)) {
          return;
        }
      }

      results.push(...filtered);
    });

    // Apply risk level filter (requires impact analysis)
    if (filters.riskLevels && filters.riskLevels.length > 0) {
      results = results.filter(event => {
        const project = this.projects.get(event.projectId);
        if (!project) return false;
        
        const analysis = analyzeMarketImpact(event, project);
        return filters.riskLevels!.includes(analysis.riskLevel);
      });
    }

    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get market impact analysis for upcoming unlocks
   */
  getMarketImpactAnalysis(projectId: string): MarketImpactAnalysis[] {
    const project = this.projects.get(projectId);
    if (!project) return [];

    const upcomingUnlocks = this.getUpcomingUnlocks(projectId);
    return upcomingUnlocks.map(event => analyzeMarketImpact(event, project));
  }

  /**
   * Get comprehensive vesting analytics for a project
   */
  getVestingAnalytics(projectId: string): VestingAnalytics | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const schedules = this.getVestingSchedules(projectId);
    const upcomingUnlocks = this.getUpcomingUnlocks(projectId);
    const historicalUnlocks = this.getHistoricalUnlocks(projectId);
    const statistics = calculateVestingStatistics(project, schedules, upcomingUnlocks);
    const marketImpact = this.getMarketImpactAnalysis(projectId);

    // Calculate remaining tokens by type
    const teamTokensRemaining = schedules
      .filter(s => s.beneficiaryType === 'team')
      .reduce((sum, s) => {
        const total = parseFloat(s.totalTokens);
        // Simplified - would calculate actual remaining based on vesting progress
        return sum + total;
      }, 0);

    const investorTokensRemaining = schedules
      .filter(s => s.beneficiaryType === 'investors')
      .reduce((sum, s) => sum + parseFloat(s.totalTokens), 0);

    // Find fully unlocked date
    const fullyUnlockedDate = schedules.reduce((latest, s) => 
      s.vestingEnd > latest ? s.vestingEnd : latest,
      schedules[0]?.vestingEnd || new Date()
    );

    return {
      project,
      schedules,
      upcomingUnlocks,
      statistics,
      marketImpact,
      historicalUnlocks,
      teamTokensRemaining: teamTokensRemaining.toString(),
      investorTokensRemaining: investorTokensRemaining.toString(),
      fullyUnlockedDate,
    };
  }

  /**
   * Get all active alerts
   */
  getAlerts(includeAcknowledged: boolean = false): VestingAlert[] {
    return includeAcknowledged 
      ? this.alerts 
      : this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Generate alerts for a vesting schedule
   */
  private generateAlertsForSchedule(
    schedule: VestingSchedule,
    events: UnlockEvent[]
  ): void {
    const project = this.projects.get(schedule.projectId);
    if (!project) return;

    // Check if project meets alert threshold
    const marketCap = parseFloat(project.marketCap || '0');
    if (marketCap < this.config.alertThresholds.minMarketCapForAlert) {
      return;
    }

    events.forEach(event => {
      const daysUntil = daysUntilUnlock(event.date);
      
      // Skip if too far in future
      if (daysUntil > this.config.alertThresholds.daysBeforeAlert) {
        return;
      }

      // Check if unlock is significant
      if (event.percentageOfCirculating < this.config.alertThresholds.minUnlockPercentage) {
        return;
      }

      // Determine alert type and severity
      let alertType: VestingAlert['alertType'] = 'upcoming_unlock';
      let severity: VestingAlert['severity'] = 'info';

      if (event.isCliffEvent) {
        alertType = 'cliff_approaching';
        severity = 'warning';
      }

      if (event.percentageOfCirculating > 20) {
        alertType = 'large_unlock';
        severity = 'critical';
      }

      const alert: VestingAlert = {
        id: `alert-${event.id}-${Date.now()}`,
        projectId: schedule.projectId,
        unlockEventId: event.id,
        alertType,
        severity,
        message: this.generateAlertMessage(event, project),
        daysUntil,
        createdAt: new Date(),
        acknowledged: false,
      };

      this.alerts.push(alert);
    });
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(event: UnlockEvent, project: TokenProject): string {
    const daysUntil = daysUntilUnlock(event.date);
    const percentage = event.percentageOfCirculating.toFixed(2);
    
    let message = `${project.name} (${project.symbol}): `;
    
    if (event.isCliffEvent) {
      message += `⚠️ Cliff unlock in ${daysUntil} days - `;
    } else {
      message += `Unlock in ${daysUntil} days - `;
    }
    
    message += `${percentage}% of circulating supply `;
    message += `(${event.beneficiaryType} tokens)`;
    
    return message;
  }

  /**
   * Get tracker statistics
   */
  getTrackerStats(): {
    totalProjects: number;
    totalSchedules: number;
    upcomingUnlocks: number;
    criticalAlerts: number;
    nextMajorUnlock: { project: string; date: Date; amount: string } | null;
  } {
    const totalProjects = this.projects.size;
    let totalSchedules = 0;
    let upcomingUnlocks = 0;

    this.schedules.forEach(schedules => {
      totalSchedules += schedules.length;
    });

    this.unlockEvents.forEach(events => {
      const now = new Date();
      upcomingUnlocks += events.filter(e => e.date > now).length;
    });

    const criticalAlerts = this.alerts.filter(a => 
      a.severity === 'critical' && !a.acknowledged
    ).length;

    // Find next major unlock
    let nextMajorUnlock: any = null;
    let largestUpcoming = 0;

    this.unlockEvents.forEach((events, projectId) => {
      const now = new Date();
      const upcoming = events.filter(e => e.date > now);
      
      upcoming.forEach(event => {
        const amount = parseFloat(event.tokensUnlocked);
        if (amount > largestUpcoming) {
          largestUpcoming = amount;
          const project = this.projects.get(projectId);
          nextMajorUnlock = {
            project: project?.name || projectId,
            date: event.date,
            amount: event.tokensUnlocked,
          };
        }
      });
    });

    return {
      totalProjects,
      totalSchedules,
      upcomingUnlocks,
      criticalAlerts,
      nextMajorUnlock,
    };
  }
}

/**
 * Create a new unlock tracker instance
 */
export function createUnlockTracker(config?: Partial<TrackerConfig>): UnlockTracker {
  return new UnlockTracker(config);
}
