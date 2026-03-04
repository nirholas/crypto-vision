/**
 * Test Server — Start/stop a real Hono server on a random port for tests.
 *
 * Usage:
 *   const { baseUrl, apiKey, stop } = await startTestServer();
 *   // ... run tests against baseUrl ...
 *   await stop();
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../..");

/** Server instance returned by startTestServer. */
export interface TestServer {
  /** Base URL of the running server, e.g. http://localhost:54321 */
  baseUrl: string;
  /** Port the server is listening on */
  port: number;
  /** API key configured for the test server */
  apiKey: string;
  /** Gracefully stop the server */
  stop: () => Promise<void>;
  /** Underlying child process (for advanced control) */
  process: ChildProcess;
}

/** Find an available port by binding to 0. */
export async function getRandomPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolvePort(port));
      } else {
        srv.close(() => reject(new Error("Failed to get random port")));
      }
    });
    srv.on("error", reject);
  });
}

/** Poll a URL until it returns a response (200 or 503 for degraded-but-up). */
export async function waitForHealth(
  url: string,
  { maxAttempts = 60, intervalMs = 500 } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Server did not become healthy at ${url} after ${maxAttempts} attempts`,
  );
}

export interface StartOptions {
  /** Override the API key (default: auto-generated test key) */
  apiKey?: string;
  /** Extra env vars to pass to the server */
  env?: Record<string, string>;
  /** Max time (ms) to wait for health (default: 30 000) */
  healthTimeout?: number;
}

/**
 * Start a real test server on a random port.
 * The caller MUST call `stop()` when done.
 */
export async function startTestServer(
  options: StartOptions = {},
): Promise<TestServer> {
  const port = await getRandomPort();
  const baseUrl = `http://localhost:${port}`;
  const apiKey = options.apiKey ?? `test-key-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
      API_KEYS: `${apiKey}:pro`,
      ...options.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Capture stderr for debugging
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg && (msg.includes("FATAL") || msg.includes("Error"))) {
      console.error(`[test-server:${port}] ${msg}`);
    }
  });

  // Detect early exit
  const earlyExit = new Promise<never>((_, reject) => {
    serverProcess.on("exit", (code) => {
      reject(new Error(`Test server exited early with code ${code}`));
    });
  });

  const maxAttempts = Math.ceil((options.healthTimeout ?? 30_000) / 500);

  await Promise.race([
    waitForHealth(`${baseUrl}/health`, { maxAttempts }),
    earlyExit,
  ]);

  const stop = async (): Promise<void> => {
    if (serverProcess.killed) return;
    serverProcess.kill("SIGTERM");
    await new Promise<void>((resolveStop) => {
      const timeout = setTimeout(() => {
        serverProcess.kill("SIGKILL");
        resolveStop();
      }, 10_000);
      timeout.unref();
      serverProcess.on("exit", () => {
        clearTimeout(timeout);
        resolveStop();
      });
    });
  };

  return { baseUrl, port, apiKey, stop, process: serverProcess };
}
