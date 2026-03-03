/**
 * E2E Global Setup — starts the real server on a random port before tests,
 * waits for /health to respond, then tears down after all tests complete.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

let serverProcess: ChildProcess | undefined;

/** Find an available port by binding to 0 and reading the OS-assigned port. */
async function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Failed to get random port")));
      }
    });
    srv.on("error", reject);
  });
}

/** Poll a URL until it returns 200 or we exceed maxAttempts. */
async function waitForHealth(
  url: string,
  { maxAttempts = 60, intervalMs = 500 } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) {
        // 503 "degraded" is still a valid health response (missing Redis etc.)
        return;
      }
    } catch {
      // Server not ready yet — retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Server did not become healthy at ${url} after ${maxAttempts} attempts`,
  );
}

export async function setup(): Promise<void> {
  const port = await getRandomPort();
  const baseUrl = `http://localhost:${port}`;

  // Expose to test files via env
  process.env.E2E_BASE_URL = baseUrl;
  process.env.E2E_PORT = String(port);

  console.log(`[e2e] Starting server on port ${port}…`);

  // Use a deterministic test API key with 'pro' tier (2000 req/min)
  // so smoke tests don't get rate-limited at the 30 req/min public tier.
  const testApiKey = "e2e-smoke-test-key-00000000";
  process.env.E2E_API_KEY = testApiKey;

  serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
      API_KEYS: `${testApiKey}:pro`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Forward server stderr so startup errors are visible
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) console.error(`[server] ${msg}`);
  });

  // Forward server stdout (optional, for debugging)
  serverProcess.stdout?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) console.log(`[server] ${msg}`);
  });

  // Detect early crashes
  const earlyExit = new Promise<never>((_, reject) => {
    serverProcess?.on("exit", (code) => {
      reject(new Error(`Server exited early with code ${code}`));
    });
  });

  // Wait for health OR early crash
  await Promise.race([
    waitForHealth(`${baseUrl}/health`),
    earlyExit,
  ]);

  console.log(`[e2e] Server healthy at ${baseUrl}`);
}

export async function teardown(): Promise<void> {
  if (serverProcess && !serverProcess.killed) {
    console.log("[e2e] Shutting down server…");
    serverProcess.kill("SIGTERM");

    // Wait for graceful shutdown (max 10s)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        serverProcess?.kill("SIGKILL");
        resolve();
      }, 10_000);
      timeout.unref();

      serverProcess?.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    console.log("[e2e] Server shut down");
  }
}
