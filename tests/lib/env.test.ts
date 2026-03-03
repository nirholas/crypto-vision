/**
 * Tests for lib/env.ts — Environment variable validation via Zod
 *
 * We import this carefully — the module calls process.exit(1) on invalid env.
 * Instead of importing it directly, we test the validation logic by checking
 * that valid env passes and the module exports the validated env object.
 */

import { describe, it, expect } from "vitest";

describe("env validation", () => {
  it("exports a validated env object with default values", async () => {
    // The module has already been loaded during test setup.
    // If env validation failed, the test process would have exited.
    // We dynamic-import and verify the exports exist.
    const envMod = await import("../../src/lib/env.js");
    expect(envMod.env).toBeDefined();
    expect(typeof envMod.env).toBe("object");
  });

  it("env.PORT defaults to '8080'", async () => {
    const { env } = await import("../../src/lib/env.js");
    // PORT is either the value from process.env or the default '8080'
    expect(typeof env.PORT).toBe("string");
    expect(Number(env.PORT)).toBeGreaterThan(0);
    expect(Number(env.PORT)).toBeLessThanOrEqual(65535);
  });

  it("env.NODE_ENV defaults to 'development' or is valid", async () => {
    const { env } = await import("../../src/lib/env.js");
    expect(["development", "production", "test"]).toContain(env.NODE_ENV);
  });

  it("env.GCP_REGION has a default value", async () => {
    const { env } = await import("../../src/lib/env.js");
    expect(env.GCP_REGION).toBeDefined();
    expect(typeof env.GCP_REGION).toBe("string");
  });

  it("env.BQ_DATASET defaults to 'crypto_vision'", async () => {
    const { env } = await import("../../src/lib/env.js");
    expect(env.BQ_DATASET).toBe("crypto_vision");
  });

  it("env.CACHE_MAX_ENTRIES defaults to '200000'", async () => {
    const { env } = await import("../../src/lib/env.js");
    expect(env.CACHE_MAX_ENTRIES).toBe("200000");
  });

  it("all optional API key fields are string or undefined", async () => {
    const { env } = await import("../../src/lib/env.js");
    const optionalKeys = [
      "GROQ_API_KEY",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENROUTER_API_KEY",
      "COINGECKO_API_KEY",
      "COINCAP_API_KEY",
      "COINGLASS_API_KEY",
      "ETHERSCAN_API_KEY",
    ] as const;

    for (const key of optionalKeys) {
      const value = env[key];
      expect(
        value === undefined || typeof value === "string",
        `${key} should be string or undefined`,
      ).toBe(true);
    }
  });
});
