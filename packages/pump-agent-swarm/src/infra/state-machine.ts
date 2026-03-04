// Finite State Machine for Swarm Lifecycle
// Implements SwarmStateMachine per Prompt 05

import type {
  SwarmPhase,
  PhaseTransition,
  StateMachineConfig
} from '../types';
// Event bus is required, but file not found. We'll type as any for now and update when available.
// import { SwarmEventBus } from './event-bus';

type SwarmEventBus = any; // TODO: Replace with actual import when available

export const DEFAULT_SWARM_TRANSITIONS: PhaseTransition[] = [
  // idle → initializing → funding → [scanning | creating_narrative]
  { from: 'idle', to: 'initializing' },
  { from: 'initializing', to: 'funding' },
  { from: 'funding', to: 'scanning' },
  { from: 'funding', to: 'creating_narrative' },
  // scanning → evaluating → [minting | scanning]
  { from: 'scanning', to: 'evaluating' },
  { from: 'evaluating', to: 'minting' },
  { from: 'evaluating', to: 'scanning' },
  // creating_narrative → minting
  { from: 'creating_narrative', to: 'minting' },
  // minting → bundling → distributing → trading
  { from: 'minting', to: 'bundling' },
  { from: 'bundling', to: 'distributing' },
  { from: 'distributing', to: 'trading' },
  // trading → [market_making | accumulating | graduating | exiting]
  { from: 'trading', to: 'market_making' },
  { from: 'trading', to: 'accumulating' },
  { from: 'trading', to: 'graduating' },
  { from: 'trading', to: 'exiting' },
  // market_making → [trading | graduating | exiting]
  { from: 'market_making', to: 'trading' },
  { from: 'market_making', to: 'graduating' },
  { from: 'market_making', to: 'exiting' },
  // accumulating → [trading | graduating | exiting]
  { from: 'accumulating', to: 'trading' },
  { from: 'accumulating', to: 'graduating' },
  { from: 'accumulating', to: 'exiting' },
  // graduating → exiting
  { from: 'graduating', to: 'exiting' },
  // exiting → reclaiming → completed
  { from: 'exiting', to: 'reclaiming' },
  { from: 'reclaiming', to: 'completed' },
  // Any phase → paused → (resume to previous)
  { from: 'idle', to: 'paused' },
  { from: 'initializing', to: 'paused' },
  { from: 'funding', to: 'paused' },
  { from: 'scanning', to: 'paused' },
  { from: 'evaluating', to: 'paused' },
  { from: 'creating_narrative', to: 'paused' },
  { from: 'minting', to: 'paused' },
  { from: 'bundling', to: 'paused' },
  { from: 'distributing', to: 'paused' },
  { from: 'trading', to: 'paused' },
  { from: 'market_making', to: 'paused' },
  { from: 'accumulating', to: 'paused' },
  { from: 'graduating', to: 'paused' },
  { from: 'exiting', to: 'paused' },
  { from: 'reclaiming', to: 'paused' },
  { from: 'completed', to: 'paused' },
  { from: 'error', to: 'paused' },
  { from: 'emergency_exit', to: 'paused' },
  // paused → (resume to previous) handled in class
  // Any phase → error → [reclaiming | emergency_exit]
  { from: 'idle', to: 'error' },
  { from: 'initializing', to: 'error' },
  { from: 'funding', to: 'error' },
  { from: 'scanning', to: 'error' },
  { from: 'evaluating', to: 'error' },
  { from: 'creating_narrative', to: 'error' },
  { from: 'minting', to: 'error' },
  { from: 'bundling', to: 'error' },
  { from: 'distributing', to: 'error' },
  { from: 'trading', to: 'error' },
  { from: 'market_making', to: 'error' },
  { from: 'accumulating', to: 'error' },
  { from: 'graduating', to: 'error' },
  { from: 'exiting', to: 'error' },
  { from: 'reclaiming', to: 'error' },
  { from: 'completed', to: 'error' },
  { from: 'paused', to: 'error' },
  { from: 'emergency_exit', to: 'error' },
  // error → [reclaiming | emergency_exit]
  { from: 'error', to: 'reclaiming' },
  { from: 'error', to: 'emergency_exit' },
  // emergency_exit → reclaiming → completed
  { from: 'emergency_exit', to: 'reclaiming' },
  { from: 'reclaiming', to: 'completed' },
];

interface PhaseHistoryEntry {
  phase: SwarmPhase;
  enteredAt: number;
  exitedAt?: number;
  duration?: number;
}

type PhaseHandler = () => void | Promise<void>;

export class SwarmStateMachine {
  private config: StateMachineConfig;
  private eventBus: SwarmEventBus;
  private _currentPhase: SwarmPhase;
  private phaseHistory: PhaseHistoryEntry[] = [];
  private phaseEnterHandlers: Map<SwarmPhase, PhaseHandler[]> = new Map();
  private phaseExitHandlers: Map<SwarmPhase, PhaseHandler[]> = new Map();
  private timeoutHandles: Map<SwarmPhase, NodeJS.Timeout> = new Map();
  private auditLog: Array<{ from: SwarmPhase; to: SwarmPhase; at: number; reason?: string }> = [];
  private pausedPhase: SwarmPhase | null = null;
  private phaseStartTime: number = Date.now();

  constructor(config: StateMachineConfig, eventBus: SwarmEventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this._currentPhase = config.initialPhase;
    this.phaseHistory.push({ phase: this._currentPhase, enteredAt: Date.now() });
    this.emitEvent('phase:entered', { phase: this._currentPhase, duration_in_previous: 0 });
    this.setupTimeout(this._currentPhase);
  }

  get currentPhase(): SwarmPhase {
    return this._currentPhase;
  }

  async transition(to: SwarmPhase): Promise<boolean> {
    if (!this.canTransition(to)) throw new Error(`Invalid transition: ${this._currentPhase} → ${to}`);
    const transition = this.config.transitions.find(t => t.from === this._currentPhase && t.to === to);
    if (transition?.guard && !(await transition.guard())) return false;
    await this.runPhaseExitHandlers(this._currentPhase);
    this.emitEvent('phase:entering', { from: this._currentPhase, to });
    this.recordAudit(this._currentPhase, to);
    this.clearTimeout(this._currentPhase);
    const prevPhase = this._currentPhase;
    this._currentPhase = to;
    this.phaseHistory[this.phaseHistory.length - 1].exitedAt = Date.now();
    this.phaseHistory[this.phaseHistory.length - 1].duration = this.phaseHistory[this.phaseHistory.length - 1].exitedAt! - this.phaseHistory[this.phaseHistory.length - 1].enteredAt;
    this.phaseHistory.push({ phase: to, enteredAt: Date.now() });
    this.phaseStartTime = Date.now();
    if (transition?.action) await transition.action();
    await this.runPhaseEnterHandlers(to);
    this.emitEvent('phase:entered', { phase: to, duration_in_previous: this.getPhaseDuration(prevPhase) });
    this.setupTimeout(to);
    return true;
  }

  canTransition(to: SwarmPhase): boolean {
    return this.config.transitions.some(t => t.from === this._currentPhase && t.to === to);
  }

  getValidTransitions(): SwarmPhase[] {
    return this.config.transitions.filter(t => t.from === this._currentPhase).map(t => t.to);
  }

  getPhaseHistory(): PhaseHistoryEntry[] {
    return [...this.phaseHistory];
  }

  getCurrentPhaseDuration(): number {
    return Date.now() - this.phaseStartTime;
  }

  onPhaseEnter(phase: SwarmPhase, handler: PhaseHandler): void {
    if (!this.phaseEnterHandlers.has(phase)) this.phaseEnterHandlers.set(phase, []);
    this.phaseEnterHandlers.get(phase)!.push(handler);
  }

  onPhaseExit(phase: SwarmPhase, handler: PhaseHandler): void {
    if (!this.phaseExitHandlers.has(phase)) this.phaseExitHandlers.set(phase, []);
    this.phaseExitHandlers.get(phase)!.push(handler);
  }

  forceTransition(to: SwarmPhase): void {
    this.recordAudit(this._currentPhase, to, 'force');
    this.clearTimeout(this._currentPhase);
    this._currentPhase = to;
    this.phaseHistory.push({ phase: to, enteredAt: Date.now() });
    this.phaseStartTime = Date.now();
    this.emitEvent('phase:entered', { phase: to, duration_in_previous: 0 });
    this.setupTimeout(to);
  }

  pause(): void {
    if (this._currentPhase === 'paused') return;
    this.pausedPhase = this._currentPhase;
    this.forceTransition('paused');
  }

  resume(): void {
    if (this._currentPhase !== 'paused' || !this.pausedPhase) return;
    const to = this.pausedPhase;
    this.pausedPhase = null;
    this.forceTransition(to);
  }

  reset(): void {
    this._currentPhase = this.config.initialPhase;
    this.phaseHistory = [{ phase: this._currentPhase, enteredAt: Date.now() }];
    this.phaseStartTime = Date.now();
    this.emitEvent('phase:entered', { phase: this._currentPhase, duration_in_previous: 0 });
    this.setupTimeout(this._currentPhase);
  }

  private async runPhaseEnterHandlers(phase: SwarmPhase) {
    const handlers = this.phaseEnterHandlers.get(phase) || [];
    for (const h of handlers) await h();
  }

  private async runPhaseExitHandlers(phase: SwarmPhase) {
    const handlers = this.phaseExitHandlers.get(phase) || [];
    for (const h of handlers) await h();
  }

  private setupTimeout(phase: SwarmPhase) {
    const transition = this.config.transitions.find(t => t.from === phase);
    const timeoutMs = transition?.timeoutMs;
    if (timeoutMs && timeoutMs > 0) {
      const handle = setTimeout(() => {
        this.emitEvent('phase:timeout', { phase, timeoutMs });
        const next = this.config.onTimeout(phase);
        if (next && this.canTransition(next)) {
          this.transition(next).catch(err => this.emitEvent('phase:error', { phase, error: err }));
        }
      }, timeoutMs);
      this.timeoutHandles.set(phase, handle);
    }
  }

  private clearTimeout(phase: SwarmPhase) {
    const handle = this.timeoutHandles.get(phase);
    if (handle) {
      clearTimeout(handle);
      this.timeoutHandles.delete(phase);
    }
  }

  private emitEvent(type: string, payload: Record<string, unknown>) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit({
        id: this.generateId(),
        type,
        category: 'lifecycle',
        source: 'SwarmStateMachine',
        payload,
        timestamp: Date.now(),
      });
    }
  }

  private recordAudit(from: SwarmPhase, to: SwarmPhase, reason?: string) {
    this.auditLog.push({ from, to, at: Date.now(), reason });
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  private getPhaseDuration(phase: SwarmPhase): number {
    const entry = this.phaseHistory.find(h => h.phase === phase);
    if (!entry) return 0;
    return (entry.exitedAt ?? Date.now()) - entry.enteredAt;
  }

  private generateId(): string {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
