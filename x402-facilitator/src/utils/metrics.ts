class Counter {
  private counts: Map<string, number> = new Map();

  inc(labels?: Record<string, string>) {
    const key = labels ? JSON.stringify(labels) : '__default__';
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  get(labels?: Record<string, string>): number {
    const key = labels ? JSON.stringify(labels) : '__default__';
    return this.counts.get(key) ?? 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}

class Histogram {
  private values: number[] = [];

  observe(value: number) {
    this.values.push(value);
    // Keep only last 1000 observations
    if (this.values.length > 1000) this.values.shift();
  }

  get avg(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  get p99(): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  }

  get count(): number {
    return this.values.length;
  }
}

export const metrics = {
  // Verification
  verifyRequests: new Counter(),
  verifyErrors: new Counter(),
  verifyLatency: new Histogram(),

  // Settlement
  settleSuccess: new Counter(),
  settleFailed: new Counter(),
  settleRejected: new Counter(),
  settleLatency: new Histogram(),

  // HTTP
  httpRequests: new Counter(),
  httpErrors: new Counter(),

  /** Export all metrics as a JSON object (for /health or /metrics endpoint) */
  toJSON() {
    return {
      verify: {
        requests: this.verifyRequests.getAll(),
        errors: this.verifyErrors.get(),
        latency: {
          avg: this.verifyLatency.avg,
          p99: this.verifyLatency.p99,
          count: this.verifyLatency.count,
        },
      },
      settle: {
        success: this.settleSuccess.getAll(),
        failed: this.settleFailed.getAll(),
        rejected: this.settleRejected.get(),
        latency: {
          avg: this.settleLatency.avg,
          p99: this.settleLatency.p99,
          count: this.settleLatency.count,
        },
      },
    };
  },
};
