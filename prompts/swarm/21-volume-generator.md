# Prompt 21 — Volume Generator

## Agent Identity & Rules

```
You are the VOLUME-GENERATOR builder. Create the volume generation planning system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add volume generator with time-based curves and target tracking"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/volume-generator.ts` — generates volume plans that specify exactly how much volume should be generated each minute/hour, following configurable curves (ramp-up, steady, burst, natural).

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/volume-generator.ts`

## Dependencies

- `../types.ts` — `TradeDirection` (P01)
- `../infra/event-bus.ts` — `SwarmEventBus` (P04)
- `../infra/logger.ts` — `SwarmLogger` (P07)

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/volume-generator.ts`

1. **`VolumeGenerator` class**:
   - `constructor(config: VolumeGeneratorConfig)`
   - `generatePlan(durationMs: number, totalVolumeSol: number): VolumePlan`
   - `getCurrentTarget(): number` — SOL volume target for this minute
   - `getProgress(): { actual: number; target: number; percent: number }`
   - `recordVolume(sol: number): void` — track actual volume against target
   - `adjustPlan(newTotalSol: number): void` — hot-adjust remaining plan

2. **Volume curves**:
   ```typescript
   type VolumeCurve = 'constant' | 'ramp-up' | 'ramp-down' | 'bell-curve' | 'burst' | 'natural' | 'custom';

   interface VolumeGeneratorConfig {
     curve: VolumeCurve;
     /** For 'burst': intervals between bursts */
     burstIntervalMs?: number;
     /** For 'burst': duration of each burst */
     burstDurationMs?: number;
     /** For 'natural': simulate human activity patterns */
     peakHours?: number[]; // UTC hours with peak activity
     /** For 'custom': array of [timestamp, volume] data points */
     customCurve?: Array<[number, number]>;
     /** Randomness factor (0-1). 0 = exact, 1 = highly variable */
     jitter: number;
   }
   ```

3. **Volume plan**: Array of time-bucketed volume targets
   ```typescript
   interface VolumePlan {
     id: string;
     totalTargetSol: number;
     durationMs: number;
     buckets: Array<{
       startMs: number;
       endMs: number;
       targetSol: number;
       actualSol: number;
       trades: number;
     }>;
     curve: VolumeCurve;
     createdAt: number;
   }
   ```

4. **Curve implementations**:
   - `constant`: Equal volume each bucket
   - `ramp-up`: Linear increase from 20% to 180% of average
   - `ramp-down`: Opposite of ramp-up
   - `bell-curve`: Normal distribution centered on midpoint
   - `burst`: Periods of high activity (4x average) separated by quiet periods (0.25x average)
   - `natural`: Simulates real market patterns — higher volume during US/Asia market hours, lower overnight
   - `custom`: User-defined curve via data points with interpolation

5. **Adaptive adjustment**: If actual volume is behind target, increase intensity for remaining buckets. If ahead, reduce.

### Success Criteria

- All curve types produce valid volume plans
- Plans sum to the requested total volume
- Adaptive adjustment keeps actual close to target
- Jitter adds realistic variance without overshooting
- Compiles with `npx tsc --noEmit`
