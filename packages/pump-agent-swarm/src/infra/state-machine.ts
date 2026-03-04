/**
 * Swarm State Machine — Finite state machine for swarm lifecycle management
 *
 * Features:
 * - Typed phases with validated transitions
 * - Async guard functions for transition authorization
 * - Per-phase configurable timeouts with automatic escalation
 * - Phase enter/exit hooks for lifecycle orchestration
 * - Pause/resume with pre-pause phase preservation
 * - Force transition for emergency bypass
 * - Immutable audit trail of all transitions
 * - Full event bus integration for observability
 */

import type {
  PhaseTransition,
  StateMachineConfig,
  SwarmPhase,
} from '../types.js';

import type { SwarmEventBus } from './event-bus.js';

// ─── Phase History Entry ──────────────────────────────────────

export interface PhaseHistoryEntry {
  /** The phase that was active */
  phase: SwarmPhase;
  /** Unix epoch ms when the phase was entered */
  enteredAt: number;
  /** Unix epoch ms when the phase was exited (undefined if current) */
  exitedAt?: number;
  /** Duration in ms (undefined if current) */
  duration?: number;
}

// ─── Audit Log Entry ─────────────────────────────────────────

export interface AuditLogEntry {
  /** Timestamp of the transition */
  timestamp: number;
  /** Phase transitioned from */
  from: SwarmPhase;
  /** Phase transitioned to */
  to: SwarmPhase;
  /** Whether the transition was forced (guard bypass) */
  forced: boolean;
  /** Whether a guard was evaluated */
  guardEvaluated: boolean;
  /** Result of the guard (true = allowed, false = blocked, undefined = no guard) */
  guardResult?: boolean;
  /** Whether the transition succeeded */
  success: boolean;
  /** Error message if the transition failed */
  error?: string;
  /** Duration in the previous phase (ms) */
  durationInPrevious: number;
}

// ─── Phase Hook Types ─────────────────────────────────────────

type PhaseHook = () => void | Promise<void>;

// ─── Default Timeouts ─────────────────────────────────────────

const DEFAULT_PHASE_TIMEOUTS: Partial<Record<SwarmPhase, number>> = {
  minting: 60_000,
  bundling: 30_000,
  initializing: 30_000,
  funding: 120_000,
  distributing: 60_000,
};

// ─── All non-terminal phases for wildcard transitions ─────────

const ALL_OPERATIONAL_PHASES: readonly SwarmPhase[] = [
  'idle',
  'initializing',
  'funding',
  'scanning',
  'evaluating',
  'creating_narrative',
  'minting',
  'bundling',
  'distributing',
  'trading',
  'market_making',
  'accumulating',
  'graduating',
  'exiting',
  'reclaiming',
] as const;

// ─── Default Transitions ─────────────────────────────────────

function buildDefaultTransitions(): PhaseTransition[] {
  const transitions: PhaseTransition[] = [
    // Core lifecycle
    { from: 'idle', to: 'initializing' },
    { from: 'initializing', to: 'funding' },
    { from: 'funding', to: 'scanning' },
    { from: 'funding', to: 'creating_narrative' },

    // Scanning loop
    { from: 'scanning', to: 'evaluating' },
    { from: 'evaluating', to: 'minting' },
    { from: 'evaluating', to: 'scanning' },

    // Narrative → mint
    { from: 'creating_narrative', to: 'minting' },

    // Mint → bundle → distribute → trade
    { from: 'minting', to: 'bundling', timeoutMs: 60_000 },
    { from: 'bundling', to: 'distributing', timeoutMs: 30_000 },
    { from: 'distributing', to: 'trading' },

    // Trading sub-phases
    { from: 'trading', to: 'market_making' },
    { from: 'trading', to: 'accumulating' },
    { from: 'trading', to: 'graduating' },
    { from: 'trading', to: 'exiting' },

    // Market making transitions
    { from: 'market_making', to: 'trading' },
    { from: 'market_making', to: 'graduating' },
    { from: 'market_making', to: 'exiting' },

    // Accumulating transitions
    { from: 'accumulating', to: 'trading' },
    { from: 'accumulating', to: 'graduating' },
    { from: 'accumulating', to: 'exiting' },

    // Graduating → exiting
    { from: 'graduating', to: 'exiting' },

    // Exit flow
    { from: 'exiting', to: 'reclaiming' },
    { from: 'reclaiming', to: 'completed' },

    // Error recovery
    { from: 'error', to: 'reclaiming' },
    { from: 'error', to: 'emergency_exit' },

    // Emergency exit flow
    { from: 'emergency_exit', to: 'reclaiming' },
  ];

  // Any operational phase → paused, stopped, error, emergency_exit
  for (const phase of ALL_OPERATIONAL_PHASES) {
    transitions.push({ from: phase, to: 'paused' });
    transitions.push({ from: phase, to: 'stopped' });
    transitions.push({ from: phase, to: 'error' });
    transitions.push({ from: phase, to: 'emergency_exit' });
  }

  return transitions;
}

/**
 * Default transition table for the pump agent swarm lifecycle.
 *
 * ```
 * idle → initializing → funding → [scanning | creating_narrative]
 * scanning → evaluating → [minting | scanning]
 * creating_narrative → minting
 * minting → bundling → distributing → trading
 * trading → [market_making | accumulating | graduating | exiting]
 * market_making → [trading | graduating | exiting]
 * accumulating → [trading | graduating | exiting]
 * graduating → exiting
 * exiting → reclaiming → completed
 * Any phase → paused → (resume to previous)
 * Any phase → error → [reclaiming | emergency_exit]
 * Any phase → emergency_exit → reclaiming → completed
 * ```
 */
export const DEFAULT_SWARM_TRANSITIONS: PhaseTransition[] = buildDefaultTransitions();

// ─── SwarmStateMachine ────────────────────────────────────────

export class SwarmStateMachine {
  // ── Internal State ──────────────────────────────────────────
  private phase: SwarmPhase;
  private readonly config: StateMachineConfig;
  private readonly eventBus: SwarmEventBus;

  /** Immutable history of all phase entries */
  private readonly history: PhaseHistoryEntry[] = [];

  /** Immutable audit log of all transition attempts */
  private readonly auditLog: AuditLogEntry[] = [];

  /** Enter hooks keyed by phase */
  private readonly enterHooks = new Map<SwarmPhase, PhaseHook[]>();

  /** Exit hooks keyed by phase */
  private readonly exitHooks = new Map<SwarmPhase, PhaseHook[]>();

  /** Active timeout timer for the current phase */
  private phaseTimer: ReturnType<typeof setTimeout> | undefined;

  /** Phase before pause (for resume) */
  private prePausePhase: SwarmPhase | undefined;

  /** Whether a transition is currently in progress (prevents re-entrancy) */
  private transitioning = false;

  /** Timestamp when the current phase was entered */
  private phaseEnteredAt: number;

  /** Lookup index: from → Set<to> for O(1) validity checks */
  private readonly transitionIndex = new Map<SwarmPhase, Set<SwarmPhase>>();

  /** Lookup index: from:to → PhaseTransition for guard/action access */
  private readonly transitionMap = new Map<string, PhaseTransition>();

  constructor(config: StateMachineConfig, eventBus: SwarmEventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.phase = config.initialPhase;
    this.phaseEnteredAt = Date.now();

    // Build lookup indexes
    this.rebuildIndexes();

    // Record initial phase in history
    this.history.push({
      phase: config.initialPhase,
      enteredAt: this.phaseEnteredAt,
    });

    // Start timeout for initial phase if configured
    this.startPhaseTimeout(config.initialPhase);
  }

  // ── Public Getters ──────────────────────────────────────────

  /** Current phase of the state machine */
  get currentPhase(): SwarmPhase {
    return this.phase;
  }

  // ── Transition Validation ───────────────────────────────────

  /**
   * Check whether a transition from the current phase to `to` is defined
   * in the transition table.
   */
  canTransition(to: SwarmPhase): boolean {
    const targets = this.transitionIndex.get(this.phase);
    return targets !== undefined && targets.has(to);
  }

  /**
   * List all phases reachable from the current phase.
   */
  getValidTransitions(): SwarmPhase[] {
    const targets = this.transitionIndex.get(this.phase);
    return targets ? [...targets] : [];
  }

  // ── Transition ──────────────────────────────────────────────

  /**
   * Attempt a guarded transition from the current phase to `to`.
   *
   * 1. Validates the transition is defined
   * 2. Evaluates the guard (if any)
   * 3. Runs exit hooks for current phase
   * 4. Runs the transition action (if any)
   * 5. Runs enter hooks for the new phase
   * 6. Emits events to the event bus
   * 7. Records audit log entry
   *
   * Returns `true` if the transition succeeded, `false` if blocked by a guard.
   * Throws if the transition is undefined or if an error occurs during hooks/actions.
   */
  async transition(to: SwarmPhase): Promise<boolean> {
    if (this.transitioning) {
      throw new Error(
        `Re-entrant transition detected: cannot transition to '${to}' while already transitioning`,
      );
    }

    if (!this.canTransition(to)) {
      const entry = this.createAuditEntry(this.phase, to, false, false, undefined, false, `Invalid transition: '${this.phase}' → '${to}'`);
      this.auditLog.push(Object.freeze(entry));
      throw new Error(
        `Invalid transition: '${this.phase}' → '${to}'. Valid targets: [${this.getValidTransitions().join(', ')}]`,
      );
    }

    this.transitioning = true;
    const from = this.phase;
    const transitionDef = this.transitionMap.get(`${from}:${to}`);
    const now = Date.now();
    const durationInPrevious = now - this.phaseEnteredAt;

    try {
      // Evaluate guard
      if (transitionDef?.guard) {
        const allowed = await transitionDef.guard();
        if (!allowed) {
          const entry = this.createAuditEntry(from, to, false, true, false, false);
          this.auditLog.push(Object.freeze(entry));
          return false;
        }
      }

      // Emit entering event
      this.eventBus.emit('phase:entering', 'lifecycle', 'state-machine', {
        from,
        to,
      });

      // Run exit hooks for current phase
      await this.runHooks(this.exitHooks.get(from));

      // Run transition action
      if (transitionDef?.action) {
        await transitionDef.action();
      }

      // Clear current phase timeout
      this.clearPhaseTimeout();

      // Close current history entry
      const currentEntry = this.history[this.history.length - 1];
      if (currentEntry && currentEntry.exitedAt === undefined) {
        currentEntry.exitedAt = now;
        currentEntry.duration = now - currentEntry.enteredAt;
      }

      // Update phase
      this.phase = to;
      this.phaseEnteredAt = now;

      // Track pre-pause phase
      if (to === 'paused') {
        this.prePausePhase = from;
      } else if (from === 'paused') {
        this.prePausePhase = undefined;
      }

      // Add new history entry
      this.history.push({
        phase: to,
        enteredAt: now,
      });

      // Start timeout for new phase
      this.startPhaseTimeout(to);

      // Run enter hooks for new phase
      await this.runHooks(this.enterHooks.get(to));

      // Emit entered event
      this.eventBus.emit('phase:entered', 'lifecycle', 'state-machine', {
        phase: to,
        duration_in_previous: durationInPrevious,
      });

      // Record audit entry
      const auditEntry = this.createAuditEntry(
        from,
        to,
        false,
        transitionDef?.guard !== undefined,
        transitionDef?.guard !== undefined ? true : undefined,
        true,
      );
      this.auditLog.push(Object.freeze(auditEntry));

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Emit phase error
      this.eventBus.emit('phase:error', 'error', 'state-machine', {
        phase: from,
        error: errorMessage,
      });

      // Record failed audit entry
      const auditEntry = this.createAuditEntry(from, to, false, false, undefined, false, errorMessage);
      this.auditLog.push(Object.freeze(auditEntry));

      // Delegate to error handler
      const recoveryPhase = this.config.onError(
        err instanceof Error ? err : new Error(errorMessage),
        from,
      );

      // If the error handler returns a different phase, force-transition there
      if (recoveryPhase !== from && recoveryPhase !== to) {
        this.forceTransition(recoveryPhase);
      }

      throw err;
    } finally {
      this.transitioning = false;
    }
  }

  // ── Force Transition (Emergency) ────────────────────────────

  /**
   * Immediately transition to `to` without evaluating guards.
   * Use for emergency situations (e.g., forced error recovery).
   *
   * Still records audit log and emits events, but skips guards and
   * does not run transition actions.
   */
  forceTransition(to: SwarmPhase): void {
    const from = this.phase;
    const now = Date.now();
    const durationInPrevious = now - this.phaseEnteredAt;

    // Emit entering event
    this.eventBus.emit('phase:entering', 'lifecycle', 'state-machine', {
      from,
      to,
      forced: true,
    });

    // Clear current phase timeout
    this.clearPhaseTimeout();

    // Close current history entry
    const currentEntry = this.history[this.history.length - 1];
    if (currentEntry && currentEntry.exitedAt === undefined) {
      currentEntry.exitedAt = now;
      currentEntry.duration = now - currentEntry.enteredAt;
    }

    // Update phase
    this.phase = to;
    this.phaseEnteredAt = now;

    // Track pre-pause phase
    if (to === 'paused') {
      this.prePausePhase = from;
    }

    // Add history entry
    this.history.push({
      phase: to,
      enteredAt: now,
    });

    // Start timeout for new phase
    this.startPhaseTimeout(to);

    // Emit entered event
    this.eventBus.emit('phase:entered', 'lifecycle', 'state-machine', {
      phase: to,
      duration_in_previous: durationInPrevious,
      forced: true,
    });

    // Audit
    const auditEntry = this.createAuditEntry(from, to, true, false, undefined, true);
    this.auditLog.push(Object.freeze(auditEntry));
  }

  // ── Pause / Resume ──────────────────────────────────────────

  /**
   * Transition to 'paused' if not already paused or completed.
   * Preserves the current phase for later resume.
   */
  pause(): void {
    if (this.phase === 'paused') return;
    if (this.phase === 'completed') {
      throw new Error('Cannot pause a completed state machine');
    }
    this.forceTransition('paused');
  }

  /**
   * Return to the phase that was active before pause.
   * Throws if the machine is not currently paused.
   */
  resume(): void {
    if (this.phase !== 'paused') {
      throw new Error(`Cannot resume: current phase is '${this.phase}', not 'paused'`);
    }

    if (this.prePausePhase === undefined) {
      throw new Error('Cannot resume: no pre-pause phase recorded');
    }

    const target = this.prePausePhase;
    this.prePausePhase = undefined;
    this.forceTransition(target);
  }

  // ── Reset ───────────────────────────────────────────────────

  /**
   * Reset the state machine to its initial phase.
   * Clears timeouts but preserves history and audit log.
   */
  reset(): void {
    this.clearPhaseTimeout();

    const from = this.phase;
    const now = Date.now();

    // Close current history entry
    const currentEntry = this.history[this.history.length - 1];
    if (currentEntry && currentEntry.exitedAt === undefined) {
      currentEntry.exitedAt = now;
      currentEntry.duration = now - currentEntry.enteredAt;
    }

    this.phase = this.config.initialPhase;
    this.phaseEnteredAt = now;
    this.prePausePhase = undefined;
    this.transitioning = false;

    // Record reset in history
    this.history.push({
      phase: this.config.initialPhase,
      enteredAt: now,
    });

    // Audit
    const auditEntry = this.createAuditEntry(from, this.config.initialPhase, true, false, undefined, true);
    this.auditLog.push(Object.freeze(auditEntry));

    // Emit event
    this.eventBus.emit('phase:entered', 'lifecycle', 'state-machine', {
      phase: this.config.initialPhase,
      reset: true,
    });

    // Start timeout for initial phase
    this.startPhaseTimeout(this.config.initialPhase);
  }

  // ── Phase History ───────────────────────────────────────────

  /**
   * Return the full phase history with entry/exit timestamps and durations.
   * The last entry will have `exitedAt` and `duration` undefined if still active.
   */
  getPhaseHistory(): Array<{ phase: SwarmPhase; enteredAt: number; exitedAt?: number; duration?: number }> {
    return this.history.map((entry) => ({ ...entry }));
  }

  /**
   * Return how long (in ms) the machine has been in the current phase.
   */
  getCurrentPhaseDuration(): number {
    return Date.now() - this.phaseEnteredAt;
  }

  // ── Audit Log ───────────────────────────────────────────────

  /**
   * Return the full immutable audit log of all transition attempts.
   */
  getAuditLog(): readonly AuditLogEntry[] {
    return this.auditLog;
  }

  // ── Phase Hooks ─────────────────────────────────────────────

  /**
   * Register a handler to run when the machine enters `phase`.
   * Multiple handlers per phase are supported (called in registration order).
   */
  onPhaseEnter(phase: SwarmPhase, handler: PhaseHook): void {
    const hooks = this.enterHooks.get(phase);
    if (hooks) {
      hooks.push(handler);
    } else {
      this.enterHooks.set(phase, [handler]);
    }
  }

  /**
   * Register a handler to run when the machine exits `phase`.
   * Multiple handlers per phase are supported (called in registration order).
   */
  onPhaseExit(phase: SwarmPhase, handler: PhaseHook): void {
    const hooks = this.exitHooks.get(phase);
    if (hooks) {
      hooks.push(handler);
    } else {
      this.exitHooks.set(phase, [handler]);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────

  /**
   * Clear all timers and hooks. Call when the state machine is no longer needed.
   */
  destroy(): void {
    this.clearPhaseTimeout();
    this.enterHooks.clear();
    this.exitHooks.clear();
    this.transitioning = false;
  }

  // ── Internal: Index Management ──────────────────────────────

  private rebuildIndexes(): void {
    this.transitionIndex.clear();
    this.transitionMap.clear();

    for (const t of this.config.transitions) {
      let targets = this.transitionIndex.get(t.from);
      if (!targets) {
        targets = new Set<SwarmPhase>();
        this.transitionIndex.set(t.from, targets);
      }
      targets.add(t.to);
      this.transitionMap.set(`${t.from}:${t.to}`, t);
    }
  }

  // ── Internal: Phase Timeouts ────────────────────────────────

  private startPhaseTimeout(phase: SwarmPhase): void {
    this.clearPhaseTimeout();

    // Find timeout from transition definitions or defaults
    const timeoutMs = this.getPhaseTimeout(phase);
    if (timeoutMs === undefined || timeoutMs <= 0) return;

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = undefined;

      // Emit timeout event
      this.eventBus.emit('phase:timeout', 'lifecycle', 'state-machine', {
        phase,
        timeoutMs,
      });

      // Ask config handler where to go
      const nextPhase = this.config.onTimeout(phase);
      if (nextPhase !== phase) {
        this.forceTransition(nextPhase);
      }
    }, timeoutMs);
  }

  private clearPhaseTimeout(): void {
    if (this.phaseTimer !== undefined) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = undefined;
    }
  }

  /**
   * Resolve the timeout for a given phase.
   * Priority: transition-level timeoutMs > default phase timeouts.
   */
  private getPhaseTimeout(phase: SwarmPhase): number | undefined {
    // Check if any transition FROM this phase has a timeoutMs
    for (const t of this.config.transitions) {
      if (t.from === phase && t.timeoutMs !== undefined && t.timeoutMs > 0) {
        return t.timeoutMs;
      }
    }

    // Fall back to built-in defaults
    return DEFAULT_PHASE_TIMEOUTS[phase];
  }

  // ── Internal: Hook Execution ────────────────────────────────

  private async runHooks(hooks: PhaseHook[] | undefined): Promise<void> {
    if (!hooks || hooks.length === 0) return;

    for (const hook of hooks) {
      await hook();
    }
  }

  // ── Internal: Audit Entry ───────────────────────────────────

  private createAuditEntry(
    from: SwarmPhase,
    to: SwarmPhase,
    forced: boolean,
    guardEvaluated: boolean,
    guardResult: boolean | undefined,
    success: boolean,
    error?: string,
  ): AuditLogEntry {
    return {
      timestamp: Date.now(),
      from,
      to,
      forced,
      guardEvaluated,
      guardResult,
      success,
      error,
      durationInPrevious: Date.now() - this.phaseEnteredAt,
    };
  }
}
