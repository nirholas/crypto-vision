/**
 * Phase Controller — Multi-agent-aware phase transitions
 *
 * Controls transitions between swarm operational phases. Each phase has
 * entry conditions, exit conditions, and a maximum duration. Transitions
 * only fire when all preconditions are met.
 *
 * Features:
 * - Precondition checking before phase transitions
 * - Force transitions for manual overrides and error handling
 * - Phase timeout handling with configurable thresholds
 * - Complete phase history timeline
 * - External condition tracking (set by agents, checked internally)
 * - Event-driven notifications via SwarmEventBus
 */

import type { SwarmPhase } from '../types.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export interface PhaseCondition {
  /** Machine-readable identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this condition is currently satisfied */
  met: boolean;
  /** If critical and unmet, cannot transition */
  critical: boolean;
}

export interface PhaseRequirements {
  phase: SwarmPhase;
  conditions: PhaseCondition[];
  allMet: boolean;
  unmetConditions: PhaseCondition[];
}

export interface PhaseTransitionCheck {
  allowed: boolean;
  from: SwarmPhase;
  to: SwarmPhase;
  requirements: PhaseRequirements;
  /** Human-readable reasons why transition is blocked */
  blockers: string[];
}

export interface PhaseHistoryEntry {
  phase: SwarmPhase;
  enteredAt: number;
  exitedAt?: number;
  duration: number;
  exitReason: 'transition' | 'timeout' | 'force' | 'error';
  nextPhase?: SwarmPhase;
}

export interface PhaseControllerConfig {
  /** Starting phase */
  initialPhase: SwarmPhase;
  /** Phase timeouts (ms) — force transition after duration */
  timeouts: Partial<Record<SwarmPhase, number>>;
  /** Phase to transition to on timeout */
  timeoutTransitions: Partial<Record<SwarmPhase, SwarmPhase>>;
}

type PhaseChangeCallback = (from: SwarmPhase, to: SwarmPhase) => void;

// ─── Default Config ───────────────────────────────────────────

const DEFAULT_CONFIG: PhaseControllerConfig = {
  initialPhase: 'idle',
  timeouts: {
    initializing: 60_000,
    funding: 120_000,
    scanning: 300_000,
    evaluating: 60_000,
    creating_narrative: 120_000,
    minting: 180_000,
    bundling: 120_000,
    distributing: 180_000,
    trading: 600_000,
    market_making: 600_000,
    accumulating: 300_000,
    graduating: 180_000,
    exiting: 300_000,
    reclaiming: 120_000,
  },
  timeoutTransitions: {
    initializing: 'error',
    funding: 'error',
    scanning: 'evaluating',
    evaluating: 'scanning',
    creating_narrative: 'error',
    minting: 'error',
    bundling: 'error',
    distributing: 'error',
    trading: 'exiting',
    market_making: 'exiting',
    accumulating: 'trading',
    graduating: 'error',
    exiting: 'reclaiming',
    reclaiming: 'error',
  },
};

// ─── Allowed Transitions Map ──────────────────────────────────

/**
 * Defines which phase transitions are structurally valid.
 * Preconditions are checked separately; this is the adjacency graph.
 */
const ALLOWED_TRANSITIONS: Record<SwarmPhase, readonly SwarmPhase[]> = {
  idle: ['initializing'],
  initializing: ['funding', 'scanning', 'error'],
  funding: ['scanning', 'error'],
  scanning: ['evaluating', 'error'],
  evaluating: ['creating_narrative', 'scanning', 'error'],
  creating_narrative: ['minting', 'error'],
  minting: ['bundling', 'error'],
  bundling: ['distributing', 'accumulating', 'error'],
  distributing: ['trading', 'accumulating', 'error'],
  trading: ['market_making', 'accumulating', 'exiting', 'error'],
  market_making: ['trading', 'exiting', 'error'],
  accumulating: ['trading', 'graduating', 'exiting', 'error'],
  graduating: ['exiting', 'completed', 'error'],
  exiting: ['reclaiming', 'error'],
  reclaiming: ['completed', 'error'],
  completed: ['idle'],
  stopped: ['idle'],
  paused: ['idle', 'scanning', 'trading', 'exiting', 'error'],
  error: ['reclaiming', 'exiting', 'idle'],
  emergency_exit: ['reclaiming', 'error'],
};

// ─── Default Phase Conditions ─────────────────────────────────

function buildDefaultConditions(): Map<SwarmPhase, PhaseCondition[]> {
  const m = new Map<SwarmPhase, PhaseCondition[]>();

  m.set('idle', []);

  m.set('initializing', []);

  m.set('funding', [
    { name: 'wallets_created', description: 'Agent wallets have been generated', met: false, critical: true },
  ]);

  m.set('scanning', [
    { name: 'wallets_funded', description: 'Wallets funded with SOL', met: false, critical: true },
  ]);

  m.set('evaluating', [
    { name: 'opportunity_found', description: 'At least one opportunity identified', met: false, critical: true },
  ]);

  m.set('creating_narrative', [
    { name: 'strategy_decided', description: 'Strategy selected for the opportunity', met: false, critical: true },
  ]);

  m.set('minting', [
    { name: 'narrative_generated', description: 'Token narrative and metadata generated', met: false, critical: true },
    { name: 'token_config_ready', description: 'Token configuration validated', met: false, critical: true },
  ]);

  m.set('bundling', [
    { name: 'token_created', description: 'Token minted successfully', met: false, critical: true },
    { name: 'dev_buy_complete', description: 'Developer initial buy executed', met: false, critical: true },
  ]);

  m.set('distributing', [
    { name: 'bundle_complete', description: 'Initial bundle transaction confirmed', met: false, critical: true },
  ]);

  m.set('accumulating', [
    { name: 'distribution_done', description: 'Token distributed to wallets', met: false, critical: false },
    { name: 'traders_ready', description: 'Trader agents initialized', met: false, critical: true },
  ]);

  m.set('trading', [
    { name: 'target_supply_accumulated', description: 'Target supply threshold reached', met: false, critical: true },
    { name: 'traders_ready', description: 'Trader agents ready to execute', met: false, critical: true },
  ]);

  m.set('market_making', [
    { name: 'positions_established', description: 'Initial trading positions established', met: false, critical: true },
  ]);

  m.set('graduating', [
    { name: 'graduation_threshold_met', description: 'Token meets graduation criteria', met: false, critical: true },
  ]);

  m.set('exiting', [
    { name: 'exit_signal', description: 'Exit signal received (target P&L, stop-loss, manual, timeout)', met: false, critical: true },
  ]);

  m.set('reclaiming', [
    { name: 'positions_closed', description: 'All trading positions closed', met: false, critical: true },
  ]);

  m.set('completed', [
    { name: 'funds_reclaimed', description: 'Funds returned to treasury', met: false, critical: true },
    { name: 'report_generated', description: 'Final report produced', met: false, critical: false },
  ]);

  m.set('paused', []);
  m.set('stopped', []);
  m.set('error', []);
  m.set('emergency_exit', []);

  return m;
}

// ─── Timeout Warning Thresholds ───────────────────────────────

const TIMEOUT_WARNING_80 = 0.8;
const TIMEOUT_WARNING_90 = 0.9;

// ─── PhaseController ──────────────────────────────────────────

export class PhaseController {
  private currentPhase: SwarmPhase;
  private phaseEnteredAt: number;
  private readonly history: PhaseHistoryEntry[] = [];
  private readonly callbacks: Set<PhaseChangeCallback> = new Set();
  private readonly conditions: Map<SwarmPhase, PhaseCondition[]>;
  private readonly config: PhaseControllerConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;

  /** Tracks which warning thresholds have already been emitted for the current phase */
  private warningEmitted80 = false;
  private warningEmitted90 = false;

  constructor(eventBus: SwarmEventBus, config?: Partial<PhaseControllerConfig>) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = SwarmLogger.create('phase-controller', 'coordination');
    this.currentPhase = this.config.initialPhase;
    this.phaseEnteredAt = Date.now();
    this.conditions = buildDefaultConditions();

    this.logger.info('Phase controller initialized', {
      initialPhase: this.currentPhase,
      configuredTimeouts: Object.keys(this.config.timeouts).length,
    });

    // Record initial phase in history
    this.history.push({
      phase: this.currentPhase,
      enteredAt: this.phaseEnteredAt,
      duration: 0,
      exitReason: 'transition',
    });
  }

  // ─── Public API ───────────────────────────────────────────

  /** Returns the current operational phase */
  getCurrentPhase(): SwarmPhase {
    return this.currentPhase;
  }

  /** Check whether a transition to the target phase is currently allowed */
  canTransition(to: SwarmPhase): PhaseTransitionCheck {
    const from = this.currentPhase;
    const requirements = this.getPhaseRequirements(to);
    const blockers: string[] = [];

    // Check structural validity
    const allowedTargets = ALLOWED_TRANSITIONS[from];
    if (!allowedTargets.includes(to)) {
      blockers.push(`Transition from '${from}' to '${to}' is not a valid transition path`);
    }

    // Check critical conditions
    for (const condition of requirements.unmetConditions) {
      if (condition.critical) {
        blockers.push(`Unmet critical condition: ${condition.description} (${condition.name})`);
      }
    }

    return {
      allowed: blockers.length === 0,
      from,
      to,
      requirements,
      blockers,
    };
  }

  /**
   * Transition to a new phase.
   *
   * @param to — target phase
   * @param force — bypass precondition checks (for manual overrides, errors)
   * @throws Error if transition is not allowed and force is false
   */
  async transition(to: SwarmPhase, force = false): Promise<void> {
    const from = this.currentPhase;

    if (from === to) {
      this.logger.warn('Attempted no-op transition', { from, to });
      return;
    }

    // Error and emergency_exit transitions are always allowed
    const isErrorTransition = to === 'error' || to === 'emergency_exit';

    if (!force && !isErrorTransition) {
      const check = this.canTransition(to);
      if (!check.allowed) {
        const msg = `Phase transition blocked: ${from} → ${to}. Blockers: ${check.blockers.join('; ')}`;
        this.logger.error(msg, new Error(`from=${from}, to=${to}`));
        throw new Error(msg);
      }
    }

    const now = Date.now();
    const duration = now - this.phaseEnteredAt;
    const exitReason: PhaseHistoryEntry['exitReason'] = force ? 'force' : isErrorTransition ? 'error' : 'transition';

    // Close the current history entry
    const currentEntry = this.history[this.history.length - 1];
    if (currentEntry && !currentEntry.exitedAt) {
      currentEntry.exitedAt = now;
      currentEntry.duration = duration;
      currentEntry.exitReason = exitReason;
      currentEntry.nextPhase = to;
    }

    this.logger.info(`Phase transition: ${from} → ${to}`, {
      from,
      to,
      duration,
      exitReason,
      forced: force,
    });

    // Update state
    this.currentPhase = to;
    this.phaseEnteredAt = now;
    this.warningEmitted80 = false;
    this.warningEmitted90 = false;

    // Add new history entry
    this.history.push({
      phase: to,
      enteredAt: now,
      duration: 0,
      exitReason: 'transition', // placeholder until this phase exits
    });

    // Emit events
    const requirements = this.getPhaseRequirements(to);

    this.eventBus.emit(
      'phase:transition',
      'system',
      'phase-controller',
      { from, to, reason: exitReason },
    );

    this.eventBus.emit(
      'phase:entered',
      'system',
      'phase-controller',
      { phase: to, requirements },
    );

    // Notify callbacks
    for (const cb of this.callbacks) {
      try {
        cb(from, to);
      } catch (err) {
        this.logger.error(
          'Phase change callback error',
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
  }

  /** Get preconditions for entering a given phase */
  getPhaseRequirements(phase: SwarmPhase): PhaseRequirements {
    const conditions = this.conditions.get(phase) ?? [];
    const unmetConditions = conditions.filter((c) => !c.met);

    return {
      phase,
      conditions: [...conditions],
      allMet: unmetConditions.length === 0,
      unmetConditions,
    };
  }

  /** Returns the complete phase transition history */
  getPhaseHistory(): PhaseHistoryEntry[] {
    // Update the duration of the current (open) entry
    const current = this.history[this.history.length - 1];
    if (current && !current.exitedAt) {
      current.duration = Date.now() - current.enteredAt;
    }
    return [...this.history];
  }

  /** Returns milliseconds spent in the current phase */
  getPhaseDuration(): number {
    return Date.now() - this.phaseEnteredAt;
  }

  /**
   * Register a callback for phase changes.
   * Returns an unsubscribe function.
   */
  onPhaseChange(callback: PhaseChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Externally set whether a condition for a phase is met.
   * Agents call this as they complete work, and the controller
   * tracks readiness for phase transitions.
   */
  setConditionMet(phase: SwarmPhase, condition: string, met: boolean): void {
    const phaseConditions = this.conditions.get(phase);
    if (!phaseConditions) {
      this.logger.warn('setConditionMet: unknown phase', { phase, condition });
      return;
    }

    const target = phaseConditions.find((c) => c.name === condition);
    if (!target) {
      this.logger.warn('setConditionMet: unknown condition', { phase, condition });
      return;
    }

    const previous = target.met;
    target.met = met;

    if (met && !previous) {
      this.logger.info(`Condition met: ${phase}.${condition}`, { phase, condition });
      this.eventBus.emit(
        'phase:condition-met',
        'system',
        'phase-controller',
        { phase, condition },
      );
    } else if (!met && previous) {
      this.logger.info(`Condition unset: ${phase}.${condition}`, { phase, condition });
    }
  }

  /**
   * Check if the current phase has exceeded its max duration.
   * Should be called periodically (e.g. every 10s).
   *
   * - Emits `phase:timeout-warning` at 80% of timeout
   * - Emits `phase:timeout-warning` at 90% of timeout
   * - Triggers transition at 100% of timeout
   */
  checkTimeouts(): void {
    const timeout = this.config.timeouts[this.currentPhase];
    if (timeout === undefined || timeout <= 0) return;

    const elapsed = Date.now() - this.phaseEnteredAt;
    const ratio = elapsed / timeout;
    const remaining = Math.max(0, timeout - elapsed);

    // 80% warning
    if (ratio >= TIMEOUT_WARNING_80 && !this.warningEmitted80) {
      this.warningEmitted80 = true;
      this.logger.warn(`Phase '${this.currentPhase}' at 80% timeout`, {
        phase: this.currentPhase,
        elapsed,
        timeout,
        remaining,
      });
      this.eventBus.emit(
        'phase:timeout-warning',
        'system',
        'phase-controller',
        { phase: this.currentPhase, remaining, threshold: 0.8 },
      );
    }

    // 90% warning
    if (ratio >= TIMEOUT_WARNING_90 && !this.warningEmitted90) {
      this.warningEmitted90 = true;
      this.logger.warn(`Phase '${this.currentPhase}' at 90% timeout`, {
        phase: this.currentPhase,
        elapsed,
        timeout,
        remaining,
      });
      this.eventBus.emit(
        'phase:timeout-warning',
        'system',
        'phase-controller',
        { phase: this.currentPhase, remaining, threshold: 0.9 },
      );
    }

    // 100% — force timeout transition
    if (ratio >= 1.0) {
      const targetPhase = this.config.timeoutTransitions[this.currentPhase] ?? 'error';

      this.logger.error(
        `Phase '${this.currentPhase}' timed out after ${elapsed}ms (timeout=${timeout}, target=${targetPhase})`,
        new Error(`Phase timeout: ${this.currentPhase}`),
      );

      this.eventBus.emit(
        'phase:timeout',
        'system',
        'phase-controller',
        { phase: this.currentPhase, duration: elapsed },
      );

      // Close current history entry with timeout reason
      const currentEntry = this.history[this.history.length - 1];
      if (currentEntry && !currentEntry.exitedAt) {
        currentEntry.exitReason = 'timeout';
      }

      // Perform forced transition
      void this.transition(targetPhase, true);
    }
  }

  /**
   * Add a custom condition to a phase at runtime.
   * Useful when agents dynamically register requirements.
   */
  addCondition(phase: SwarmPhase, condition: PhaseCondition): void {
    let phaseConditions = this.conditions.get(phase);
    if (!phaseConditions) {
      phaseConditions = [];
      this.conditions.set(phase, phaseConditions);
    }

    // Avoid duplicates
    const existing = phaseConditions.find((c) => c.name === condition.name);
    if (existing) {
      existing.description = condition.description;
      existing.met = condition.met;
      existing.critical = condition.critical;
      return;
    }

    phaseConditions.push({ ...condition });
    this.logger.info(`Added condition to phase '${phase}': ${condition.name}`, {
      phase,
      condition: condition.name,
      critical: condition.critical,
    });
  }

  /**
   * Remove a condition from a phase.
   */
  removeCondition(phase: SwarmPhase, conditionName: string): boolean {
    const phaseConditions = this.conditions.get(phase);
    if (!phaseConditions) return false;

    const idx = phaseConditions.findIndex((c) => c.name === conditionName);
    if (idx === -1) return false;

    phaseConditions.splice(idx, 1);
    this.logger.info(`Removed condition from phase '${phase}': ${conditionName}`, {
      phase,
      condition: conditionName,
    });
    return true;
  }

  /**
   * Get all valid target phases from the current phase.
   */
  getAvailableTransitions(): SwarmPhase[] {
    return [...(ALLOWED_TRANSITIONS[this.currentPhase] ?? [])];
  }

  /**
   * Reset the controller to its initial state.
   * Useful for restarting a swarm run.
   */
  reset(): void {
    const from = this.currentPhase;
    this.currentPhase = this.config.initialPhase;
    this.phaseEnteredAt = Date.now();
    this.warningEmitted80 = false;
    this.warningEmitted90 = false;

    // Reset all conditions to unmet
    for (const [, conditions] of this.conditions) {
      for (const c of conditions) {
        c.met = false;
      }
    }

    // Clear history and start fresh
    this.history.length = 0;
    this.history.push({
      phase: this.config.initialPhase,
      enteredAt: this.phaseEnteredAt,
      duration: 0,
      exitReason: 'transition',
    });

    this.logger.info('Phase controller reset', { from, to: this.config.initialPhase });
  }
}
