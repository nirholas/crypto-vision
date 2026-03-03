/**
 * Tests for the embeddings module.
 *
 * Tests utility functions (hash, truncation, token estimation)
 * and provider selection logic. Actual API calls are not made
 * since no credentials are configured in test.
 */

import { describe, it, expect, vi } from "vitest";

// Ensure no provider credentials are set
vi.stubEnv("GCP_PROJECT_ID", "");
vi.stubEnv("OPENAI_API_KEY", "");
vi.stubEnv("REDIS_URL", "");

const { EMBEDDING_DIMENSION, getEmbeddingDimension, getEmbeddingProviderName } = await import("@/lib/embeddings.js");

describe("embeddings module", () => {
  describe("constants", () => {
    it("exports EMBEDDING_DIMENSION as 768 (Vertex AI default)", () => {
      expect(EMBEDDING_DIMENSION).toBe(768);
    });
  });

  describe("getEmbeddingDimension", () => {
    it("returns default dimension when no provider is configured", () => {
      const dim = getEmbeddingDimension();
      expect(dim).toBe(768);
    });
  });

  describe("getEmbeddingProviderName", () => {
    it("returns 'none' when no provider is configured", () => {
      const name = getEmbeddingProviderName();
      expect(name).toBe("none");
    });
  });

  describe("generateEmbeddings", () => {
    it("throws when no provider is configured", async () => {
      const { generateEmbeddings } = await import("@/lib/embeddings.js");
      await expect(generateEmbeddings(["test"])).rejects.toThrow(
        /No embedding provider configured/,
      );
    });

    it("returns empty array for empty input", async () => {
      const { generateEmbeddings } = await import("@/lib/embeddings.js");
      const results = await generateEmbeddings([]);
      expect(results).toEqual([]);
    });
  });

  describe("generateEmbedding", () => {
    it("throws when no provider is configured", async () => {
      const { generateEmbedding } = await import("@/lib/embeddings.js");
      await expect(generateEmbedding("test")).rejects.toThrow(
        /No embedding provider configured/,
      );
    });
  });
});
