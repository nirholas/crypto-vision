/**
 * Tests for lib/schemas.ts — Central schema barrel export
 *
 * Verifies that the barrel file exports all expected schemas from
 * validation.ts and route-schemas.ts without import errors.
 */

import { describe, it, expect } from "vitest";
import * as schemas from "../../src/lib/schemas.js";

describe("schemas barrel exports", () => {
  it("exports primitive schemas from validation.ts", () => {
    expect(schemas.CoinIdSchema).toBeDefined();
    expect(schemas.HexAddressSchema).toBeDefined();
    expect(schemas.SearchQuerySchema).toBeDefined();
    expect(schemas.PageSchema).toBeDefined();
    expect(schemas.LimitSchema).toBeDefined();
    expect(schemas.DaysSchema).toBeDefined();
    expect(schemas.PaginationSchema).toBeDefined();
    expect(schemas.ChainSlugSchema).toBeDefined();
    expect(schemas.BitcoinAddressSchema).toBeDefined();
    expect(schemas.PositiveIntSchema).toBeDefined();
  });

  it("exports POST body schemas from validation.ts", () => {
    expect(schemas.AskBodySchema).toBeDefined();
    expect(schemas.AgentRunSchema).toBeDefined();
    expect(schemas.AgentMultiSchema).toBeDefined();
    expect(schemas.OrchestrateSchema).toBeDefined();
    expect(schemas.GenerateKeySchema).toBeDefined();
    expect(schemas.PortfolioHoldingsSchema).toBeDefined();
    expect(schemas.AssetIdsSchema).toBeDefined();
    expect(schemas.RiskAnalysisSchema).toBeDefined();
  });

  it("exports validation helpers", () => {
    expect(typeof schemas.validateBody).toBe("function");
    expect(typeof schemas.validateParam).toBe("function");
    expect(typeof schemas.validateQuery).toBe("function");
    expect(typeof schemas.validateQueries).toBe("function");
    expect(typeof schemas.limitSchema).toBe("function");
  });

  it("exports route-level query schemas", () => {
    expect(schemas.MarketCoinsQuerySchema).toBeDefined();
    expect(schemas.DefiProtocolsQuerySchema).toBeDefined();
    expect(schemas.NewsListQuerySchema).toBeDefined();
    expect(schemas.AnomalyListQuerySchema).toBeDefined();
  });

  it("CoinIdSchema validates correctly", () => {
    expect(schemas.CoinIdSchema.safeParse("bitcoin").success).toBe(true);
    expect(schemas.CoinIdSchema.safeParse("ethereum").success).toBe(true);
    expect(schemas.CoinIdSchema.safeParse("sol-bridge-2").success).toBe(true);
    expect(schemas.CoinIdSchema.safeParse("").success).toBe(false);
    expect(schemas.CoinIdSchema.safeParse("../etc/passwd").success).toBe(false);
    expect(schemas.CoinIdSchema.safeParse("<script>").success).toBe(false);
  });

  it("HexAddressSchema validates Ethereum addresses", () => {
    expect(
      schemas.HexAddressSchema.safeParse(
        "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
      ).success,
    ).toBe(true);
    expect(schemas.HexAddressSchema.safeParse("0xinvalid").success).toBe(false);
    expect(schemas.HexAddressSchema.safeParse("not-an-address").success).toBe(
      false,
    );
  });

  it("AskBodySchema validates question input", () => {
    expect(
      schemas.AskBodySchema.safeParse({ question: "What is Bitcoin?" }).success,
    ).toBe(true);
    expect(schemas.AskBodySchema.safeParse({ question: "" }).success).toBe(
      false,
    );
    expect(schemas.AskBodySchema.safeParse({}).success).toBe(false);
    expect(
      schemas.AskBodySchema.safeParse({ question: "a".repeat(2001) }).success,
    ).toBe(false);
  });

  it("PaginationSchema provides defaults", () => {
    const result = schemas.PaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(25);
    }
  });

  it("DaysSchema provides default and enforces bounds", () => {
    expect(schemas.DaysSchema.safeParse(undefined).data).toBe(7);
    expect(schemas.DaysSchema.safeParse(365).success).toBe(true);
    expect(schemas.DaysSchema.safeParse(0).success).toBe(false);
    expect(schemas.DaysSchema.safeParse(366).success).toBe(false);
  });
});
