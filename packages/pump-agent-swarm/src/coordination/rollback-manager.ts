/**
 * @module rollback-manager
 *
 * Swarm State Rollback Manager — takes snapshots of swarm internal state
 * before risky operations and restores on failure. On-chain state (transactions)
 * cannot be rolled back, but the orchestrator's decision-making state can be
 * restored so it makes correct decisions going forward.
 *
 * Features:
 *  - Deep-clone snapshots via structuredClone with Map/BigInt handling
 *  - Automatic pruning when snapshot limit is reached
 *  - Diffing between two snapshots to identify meaningful changes
 *  - Event bus integration for snapshot lifecycle events
 *  - Size estimation for memory-awareness
 */

import { v4 as uuidv4 } from 'uuid';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────

export interface RollbackConfig {
  /** Max snapshots to keep */
  maxSnapshots: number;
  /** Auto-prune when limit reached */
  autoPrune: boolean;
  /** Whether to deep-clone state (vs shallow copy) */
  deepClone: boolean;
}

export interface SwarmState {
  /** Current phase */
  phase: string;
  /** Strategy parameters */
  strategy: Record<string, unknown>;
  /** Position data */
  positions: Array<{
    mint: string;
    tokens: string;
    solInvested: number;
    entryPrice: number;
  }>;
  /** Wallet balances (cached, not live) */
  walletBalances: Map<string, number>;
  /** Agent statuses */
  agentStatuses: Map<string, string>;
  /** Risk metrics */
  riskMetrics: Record<string, number>;
  /** Configuration snapshot */
  config: Record<string, unknown>;
  /** Active mint (if any) */
  activeMint?: string;
  /** Trade count so far */
  tradeCount: number;
  /** P&L at snapshot time */
  pnl: { realized: number; unrealized: number };
  /** Custom data (agents can add their own state) */
  customData: Record<string, unknown>;
}

export interface Snapshot {
  id: string;
  label: string;
  state: SwarmState;
  createdAt: number;
  /** Size estimate in bytes */
  sizeBytes: number;
}

export interface SnapshotInfo {
  id: string;
  label: string;
  createdAt: number;
  sizeBytes: number;
}

export interface SnapshotDiff {
  snapshot1: string;
  snapshot2: string;
  changes: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  positionsAdded: number;
  positionsRemoved: number;
  phaseChanged: boolean;
  pnlDelta: { realized: number; unrealized: number };
}

// ─── Constants ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RollbackConfig = {
  maxSnapshots: 20,
  autoPrune: true,
  deepClone: true,
};

// ─── Serialization Helpers ──────────────────────────────────────────────

/**
 * Convert a SwarmState to a plain object suitable for structuredClone.
 * Maps become arrays of entries so they survive cloning.
 */
function stateToSerializable(state: SwarmState): Record<string, unknown> {
  return {
    phase: state.phase,
    strategy: state.strategy,
    positions: state.positions,
    walletBalances: Array.from(state.walletBalances.entries()),
    agentStatuses: Array.from(state.agentStatuses.entries()),
    riskMetrics: state.riskMetrics,
    config: state.config,
    activeMint: state.activeMint,
    tradeCount: state.tradeCount,
    pnl: { realized: state.pnl.realized, unrealized: state.pnl.unrealized },
    customData: state.customData,
  };
}

/**
 * Restore a SwarmState from the serializable representation.
 */
function serializableToState(raw: Record<string, unknown>): SwarmState {
  const walletEntries = raw['walletBalances'] as Array<[string, number]>;
  const agentEntries = raw['agentStatuses'] as Array<[string, string]>;

  return {
    phase: raw['phase'] as string,
    strategy: raw['strategy'] as Record<string, unknown>,
    positions: raw['positions'] as SwarmState['positions'],
    walletBalances: new Map(walletEntries),
    agentStatuses: new Map(agentEntries),
    riskMetrics: raw['riskMetrics'] as Record<string, number>,
    config: raw['config'] as Record<string, unknown>,
    activeMint: raw['activeMint'] as string | undefined,
    tradeCount: raw['tradeCount'] as number,
    pnl: raw['pnl'] as { realized: number; unrealized: number },
    customData: raw['customData'] as Record<string, unknown>,
  };
}

/**
 * Estimate the byte size of a state object using JSON serialization length * 2
 * (roughly accounts for UTF-16 overhead).
 */
function estimateSize(state: SwarmState): number {
  const serializable = stateToSerializable(state);
  return JSON.stringify(serializable).length * 2;
}

/**
 * Deep-clone a SwarmState, preserving Map structures.
 */
function deepCloneState(state: SwarmState): SwarmState {
  const serializable = stateToSerializable(state);
  const cloned = structuredClone(serializable);
  return serializableToState(cloned as Record<string, unknown>);
}

/**
 * Shallow-clone a SwarmState — copies top-level references only.
 */
function shallowCloneState(state: SwarmState): SwarmState {
  return {
    phase: state.phase,
    strategy: { ...state.strategy },
    positions: [...state.positions],
    walletBalances: new Map(state.walletBalances),
    agentStatuses: new Map(state.agentStatuses),
    riskMetrics: { ...state.riskMetrics },
    config: { ...state.config },
    activeMint: state.activeMint,
    tradeCount: state.tradeCount,
    pnl: { realized: state.pnl.realized, unrealized: state.pnl.unrealized },
    customData: { ...state.customData },
  };
}

// ─── Diff Helpers ───────────────────────────────────────────────────────

/**
 * Recursively diff two values and collect changes.
 */
function diffValues(
  oldVal: unknown,
  newVal: unknown,
  path: string,
  changes: Array<{ path: string; oldValue: unknown; newValue: unknown }>,
): void {
  if (oldVal === newVal) return;

  // Both are Maps — compare entries
  if (oldVal instanceof Map && newVal instanceof Map) {
    const allKeys = new Set([...oldVal.keys(), ...newVal.keys()]);
    for (const key of allKeys) {
      const oVal = oldVal.get(key) as unknown;
      const nVal = newVal.get(key) as unknown;
      diffValues(oVal, nVal, `${path}.${String(key)}`, changes);
    }
    return;
  }

  // Both are arrays — compare element by element
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const maxLen = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      diffValues(
        oldVal[i] as unknown,
        newVal[i] as unknown,
        `${path}[${i}]`,
        changes,
      );
    }
    return;
  }

  // Both are plain objects — recurse into keys
  if (
    oldVal !== null &&
    newVal !== null &&
    typeof oldVal === 'object' &&
    typeof newVal === 'object' &&
    !Array.isArray(oldVal) &&
    !Array.isArray(newVal) &&
    !(oldVal instanceof Map) &&
    !(newVal instanceof Map)
  ) {
    const allKeys = new Set([
      ...Object.keys(oldVal as Record<string, unknown>),
      ...Object.keys(newVal as Record<string, unknown>),
    ]);
    for (const key of allKeys) {
      diffValues(
        (oldVal as Record<string, unknown>)[key],
        (newVal as Record<string, unknown>)[key],
        `${path}.${key}`,
        changes,
      );
    }
    return;
  }

  // Leaf change
  changes.push({ path, oldValue: oldVal, newValue: newVal });
}

// ─── RollbackManager Class ─────────────────────────────────────────────

export class RollbackManager {
  private readonly eventBus: SwarmEventBus;
  private readonly config: RollbackConfig;
  private readonly logger;
  private readonly snapshots: Map<string, Snapshot> = new Map();
  /** Ordered list of snapshot IDs from oldest to newest */
  private readonly order: string[] = [];

  constructor(eventBus: SwarmEventBus, config?: Partial<RollbackConfig>) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = SwarmLogger.create('rollback-manager', 'coordination');
    this.logger.info('RollbackManager initialized', {
      maxSnapshots: this.config.maxSnapshots,
      autoPrune: this.config.autoPrune,
      deepClone: this.config.deepClone,
    });
  }

  // ─── Snapshot Creation ──────────────────────────────────────────────

  /**
   * Take a snapshot of the current swarm state and return its unique ID.
   */
  createSnapshot(label: string, state: SwarmState): string {
    const id = uuidv4();
    const cloned = this.cloneState(state);
    const sizeBytes = estimateSize(state);

    const snapshot: Snapshot = {
      id,
      label,
      state: cloned,
      createdAt: Date.now(),
      sizeBytes,
    };

    this.snapshots.set(id, snapshot);
    this.order.push(id);

    this.logger.info('Snapshot created', { id, label, sizeBytes });
    this.eventBus.emit(
      'rollback:snapshot-created',
      'coordination',
      'rollback-manager',
      { id, label },
    );

    return id;
  }

  /**
   * Same as createSnapshot but respects the auto-limit — prunes oldest
   * snapshots when the maximum is reached (if autoPrune is enabled).
   */
  autoSnapshot(label: string, state: SwarmState): string {
    if (this.config.autoPrune && this.snapshots.size >= this.config.maxSnapshots) {
      const pruneCount = this.snapshots.size - this.config.maxSnapshots + 1;
      this.pruneOldSnapshots(this.config.maxSnapshots - 1);
      this.logger.info('Auto-pruned snapshots before creating new one', {
        pruneCount,
        remaining: this.snapshots.size,
      });
    }

    return this.createSnapshot(label, state);
  }

  // ─── Rollback ───────────────────────────────────────────────────────

  /**
   * Restore and return the state from a given snapshot ID.
   * Throws if the snapshot does not exist.
   */
  rollback(snapshotId: string): SwarmState {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      const msg = `Snapshot not found: ${snapshotId}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    // Return a clone so the stored snapshot remains immutable
    const restored = this.cloneState(snapshot.state);

    this.logger.info('State rolled back', {
      id: snapshotId,
      label: snapshot.label,
      phase: restored.phase,
    });
    this.eventBus.emit(
      'rollback:restored',
      'coordination',
      'rollback-manager',
      { id: snapshotId, label: snapshot.label, phase: restored.phase },
    );

    return restored;
  }

  // ─── Query Methods ──────────────────────────────────────────────────

  /**
   * List all snapshots (metadata only, no state data).
   */
  getSnapshots(): SnapshotInfo[] {
    return this.order.map((id) => {
      const s = this.snapshots.get(id)!;
      return {
        id: s.id,
        label: s.label,
        createdAt: s.createdAt,
        sizeBytes: s.sizeBytes,
      };
    });
  }

  /**
   * Get a specific snapshot by ID, or undefined if not found.
   */
  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get the most recently created snapshot, or undefined if none exist.
   */
  getLatestSnapshot(): Snapshot | undefined {
    if (this.order.length === 0) return undefined;
    const latestId = this.order[this.order.length - 1]!;
    return this.snapshots.get(latestId);
  }

  // ─── Deletion & Pruning ─────────────────────────────────────────────

  /**
   * Delete a specific snapshot by ID.
   */
  deleteSnapshot(id: string): void {
    if (!this.snapshots.has(id)) {
      this.logger.warn('Attempted to delete non-existent snapshot', { id });
      return;
    }

    this.snapshots.delete(id);
    const orderIdx = this.order.indexOf(id);
    if (orderIdx !== -1) {
      this.order.splice(orderIdx, 1);
    }

    this.logger.info('Snapshot deleted', { id });
    this.eventBus.emit(
      'rollback:snapshot-deleted',
      'coordination',
      'rollback-manager',
      { id },
    );
  }

  /**
   * Remove the oldest snapshots, keeping at most `keepCount`.
   * Returns the number of snapshots actually deleted.
   */
  pruneOldSnapshots(keepCount: number): number {
    if (keepCount < 0) {
      throw new Error('keepCount must be non-negative');
    }

    const total = this.snapshots.size;
    if (total <= keepCount) return 0;

    const deleteCount = total - keepCount;
    const toDelete = this.order.splice(0, deleteCount);

    for (const id of toDelete) {
      this.snapshots.delete(id);
    }

    this.logger.info('Snapshots pruned', { deleted: deleteCount, remaining: this.snapshots.size });
    this.eventBus.emit(
      'rollback:pruned',
      'coordination',
      'rollback-manager',
      { count: deleteCount },
    );

    return deleteCount;
  }

  // ─── Diffing ────────────────────────────────────────────────────────

  /**
   * Compare two snapshots and return a structured diff describing
   * the changes between them.
   */
  diffSnapshots(id1: string, id2: string): SnapshotDiff {
    const snap1 = this.snapshots.get(id1);
    const snap2 = this.snapshots.get(id2);

    if (!snap1) throw new Error(`Snapshot not found: ${id1}`);
    if (!snap2) throw new Error(`Snapshot not found: ${id2}`);

    const s1 = snap1.state;
    const s2 = snap2.state;

    // Collect granular changes
    const changes: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
    diffValues(s1.phase, s2.phase, 'phase', changes);
    diffValues(s1.strategy, s2.strategy, 'strategy', changes);
    diffValues(s1.positions, s2.positions, 'positions', changes);
    diffValues(s1.walletBalances, s2.walletBalances, 'walletBalances', changes);
    diffValues(s1.agentStatuses, s2.agentStatuses, 'agentStatuses', changes);
    diffValues(s1.riskMetrics, s2.riskMetrics, 'riskMetrics', changes);
    diffValues(s1.config, s2.config, 'config', changes);
    diffValues(s1.activeMint, s2.activeMint, 'activeMint', changes);
    diffValues(s1.tradeCount, s2.tradeCount, 'tradeCount', changes);
    diffValues(s1.pnl, s2.pnl, 'pnl', changes);
    diffValues(s1.customData, s2.customData, 'customData', changes);

    // Position-level summary
    const mints1 = new Set(s1.positions.map((p) => p.mint));
    const mints2 = new Set(s2.positions.map((p) => p.mint));
    let positionsAdded = 0;
    let positionsRemoved = 0;
    for (const m of mints2) {
      if (!mints1.has(m)) positionsAdded++;
    }
    for (const m of mints1) {
      if (!mints2.has(m)) positionsRemoved++;
    }

    const diff: SnapshotDiff = {
      snapshot1: id1,
      snapshot2: id2,
      changes,
      positionsAdded,
      positionsRemoved,
      phaseChanged: s1.phase !== s2.phase,
      pnlDelta: {
        realized: s2.pnl.realized - s1.pnl.realized,
        unrealized: s2.pnl.unrealized - s1.pnl.unrealized,
      },
    };

    this.logger.info('Snapshots diffed', {
      id1,
      id2,
      changeCount: changes.length,
      phaseChanged: diff.phaseChanged,
      positionsAdded,
      positionsRemoved,
    });

    return diff;
  }

  // ─── Internal Helpers ───────────────────────────────────────────────

  private cloneState(state: SwarmState): SwarmState {
    return this.config.deepClone
      ? deepCloneState(state)
      : shallowCloneState(state);
  }
}
