/**
 * Webhook Queue System for faster delivery
 * Uses in-memory queue with retry logic
 */

interface WebhookJob {
  id: string;
  url: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  nextRetry: number;
}

class WebhookQueue {
  private queue: WebhookJob[] = [];
  private processing = false;
  private readonly maxConcurrent = 10;
  private activeJobs = 0;

  add(url: string, payload: unknown, maxAttempts = 3): string {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      url,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
      nextRetry: Date.now()
    });
    this.process();
    return id;
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const now = Date.now();
      const job = this.queue.find(j => j.nextRetry <= now);
      
      if (!job) {
        // All jobs are waiting for retry
        break;
      }

      // Remove from queue
      this.queue = this.queue.filter(j => j.id !== job.id);
      this.activeJobs++;

      // Process async
      this.deliver(job).finally(() => {
        this.activeJobs--;
        if (this.queue.length > 0) {
          this.process();
        }
      });
    }

    this.processing = false;
  }

  private async deliver(job: WebhookJob): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(job.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': job.id,
          'X-Webhook-Attempt': String(job.attempts + 1)
        },
        body: JSON.stringify(job.payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok && job.attempts < job.maxAttempts - 1) {
        this.retry(job);
      }
    } catch (error) {
      if (job.attempts < job.maxAttempts - 1) {
        this.retry(job);
      }
    }
  }

  private retry(job: WebhookJob): void {
    const backoff = Math.pow(2, job.attempts) * 1000; // Exponential backoff
    this.queue.push({
      ...job,
      attempts: job.attempts + 1,
      nextRetry: Date.now() + backoff
    });
  }

  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeJobs,
      processing: this.processing
    };
  }
}

export const webhookQueue = new WebhookQueue();
