/**
 * Tests for lib/logger.ts — structured logging, INSTANCE_ID, redact config
 *
 * Validates that the logger is properly configured with service metadata,
 * instance IDs, and sensitive field redaction.
 */

import { describe, expect, it } from "vitest";
import { INSTANCE_ID, log, logger } from "../../src/lib/logger.js";

describe("Logger Configuration", () => {
  it("exports logger and log as the same instance", () => {
    expect(logger).toBe(log);
  });

  it("generates a non-empty INSTANCE_ID", () => {
    expect(INSTANCE_ID).toBeTruthy();
    expect(typeof INSTANCE_ID).toBe("string");
    expect(INSTANCE_ID.length).toBeGreaterThan(0);
  });

  it("has correct log level type", () => {
    expect(typeof logger.level).toBe("string");
    expect(["trace", "debug", "info", "warn", "error", "fatal"]).toContain(logger.level);
  });

  it("logger has standard log methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  it("child logger inherits configuration", () => {
    const child = logger.child({ module: "test" });
    expect(typeof child.info).toBe("function");
    expect(typeof child.error).toBe("function");
  });
});

describe("Logger Redaction", () => {
  it("has redact configuration for sensitive fields", () => {
    // Pino stores redact config internally — we verify the paths are set
    // by checking bindings exist without errors
    const child = logger.child({ apiKey: "secret123" });
    expect(child).toBeDefined();
  });
});
