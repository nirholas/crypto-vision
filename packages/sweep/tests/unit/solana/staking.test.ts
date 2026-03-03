/**
 * Tests for Jito and Marinade Staking Providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JitoProvider } from "../../../src/services/defi/jito.js";
import { MarinadeProvider } from "../../../src/services/defi/marinade.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis cache
vi.mock("../../../src/utils/redis.js", () => ({
  cacheGetOrFetch: vi.fn(async (_key: string, fn: () => Promise<any>) => fn()),
}));

describe("JitoProvider", () => {
  let provider: JitoProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new JitoProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("properties", () => {
    it("should have correct configuration", () => {
      expect(provider.name).toBe("Jito");
      expect(provider.supportedChains).toContain("solana");
    });
  });

  describe("getVaults", () => {
    it("should return empty array for non-solana chains", async () => {
      const vaults = await provider.getVaults("ethereum");
      expect(vaults).toHaveLength(0);
    });

    it("should return Jito staking pool for solana", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              apy: 0.078,
              apyBase: 0.065,
              apyMev: 0.013,
            }),
          });
        }
        if (url.includes("/tvl")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ tvl: 10000000 }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const vaults = await provider.getVaults("solana");

      expect(vaults).toHaveLength(1);
      expect(vaults[0].symbol).toBe("jitoSOL");
      expect(vaults[0].depositToken.symbol).toBe("SOL");
      expect(vaults[0].receiptToken?.symbol).toBe("jitoSOL");
      expect(vaults[0].apy).toBeGreaterThan(0);
    });
  });

  describe("getApy", () => {
    it("should return APY data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          apy: 0.078,
          apyBase: 0.065,
          apyMev: 0.013,
        }),
      });

      const apyData = await provider.getApy(
        "solana",
        "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
      );

      expect(apyData.apy).toBe(0.078);
      expect(apyData.apyBase).toBe(0.065);
      expect(apyData.apyReward).toBe(0.013);
    });

    it("should throw for non-solana chains", async () => {
      await expect(
        provider.getApy("ethereum", "0x123")
      ).rejects.toThrow("Jito only supports Solana");
    });
  });

  describe("getDepositQuote", () => {
    it("should calculate deposit quote correctly", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ apy: 0.078, apyBase: 0.065, apyMev: 0.013 }),
          });
        }
        if (url.includes("/tvl")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ tvl: 10000000 }),
          });
        }
        if (url.includes("/stakePool")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              totalLamports: "1000000000000",
              poolTokenSupply: "980000000000",
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const quote = await provider.getDepositQuote(
        "solana",
        "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb",
        "10",
        "User111111111111111111111111111111111111111"
      );

      expect(quote.depositAmount).toBe("10");
      expect(parseFloat(quote.expectedReceiptAmount!)).toBeGreaterThan(0);
      expect(quote.currentApy).toBeGreaterThan(0);
      expect(quote.projectedYield1y).toBeGreaterThan(0);
    });
  });

  describe("buildStakeInstruction", () => {
    it("should return stake instruction parameters", async () => {
      const instruction = await provider.buildStakeInstruction(
        "10",
        "User111111111111111111111111111111111111111"
      );

      expect(instruction.programId).toBe("SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy");
      expect(instruction.stakePoolAddress).toBe("Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb");
      expect(instruction.lamports).toBe(10000000000n);
    });
  });

  describe("buildUnstakeInstruction", () => {
    it("should return unstake instruction parameters", async () => {
      const instruction = await provider.buildUnstakeInstruction(
        "9.8",
        "User111111111111111111111111111111111111111"
      );

      expect(instruction.programId).toBe("SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy");
      expect(instruction.tokenAmount).toBe(9800000000n);
    });
  });

  describe("getStats", () => {
    it("should return Jito stats", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ apy: 0.078, apyBase: 0.065, apyMev: 0.013 }),
          });
        }
        if (url.includes("/tvl")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ tvl: 10000000 }),
          });
        }
        if (url.includes("/stakePool")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              totalLamports: "1000000000000",
              poolTokenSupply: "980000000000",
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const stats = await provider.getStats();

      expect(stats.totalStaked).toBeGreaterThan(0);
      expect(stats.apy).toBe(0.078);
      expect(stats.apyMev).toBe(0.013);
    });
  });
});

describe("MarinadeProvider", () => {
  let provider: MarinadeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MarinadeProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("properties", () => {
    it("should have correct configuration", () => {
      expect(provider.name).toBe("Marinade");
      expect(provider.supportedChains).toContain("solana");
    });
  });

  describe("getVaults", () => {
    it("should return empty array for non-solana chains", async () => {
      const vaults = await provider.getVaults("ethereum");
      expect(vaults).toHaveLength(0);
    });

    it("should return Marinade staking pool for solana", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/state")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              tvl_sol: 8000000,
              msol_price: 1.05,
              staking_apy: 0.068,
              instant_unstake_fee: 0.003,
              validators_count: 450,
              msol_supply: 7600000,
              reward_fee_bp: 200,
            }),
          });
        }
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              base_apy: 0.065,
              mnde_apy: 0.003,
              total_apy: 0.068,
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const vaults = await provider.getVaults("solana");

      expect(vaults).toHaveLength(1);
      expect(vaults[0].symbol).toBe("mSOL");
      expect(vaults[0].depositToken.symbol).toBe("SOL");
      expect(vaults[0].receiptToken?.symbol).toBe("mSOL");
    });
  });

  describe("getWithdrawQuote", () => {
    it("should calculate instant unstake quote with fee", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/state")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              tvl_sol: 8000000,
              msol_price: 1.05,
              staking_apy: 0.068,
              instant_unstake_fee: 0.003,
              validators_count: 450,
              msol_supply: 7600000,
            }),
          });
        }
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              base_apy: 0.065,
              mnde_apy: 0.003,
              total_apy: 0.068,
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const quote = await provider.getWithdrawQuote(
        "solana",
        "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
        "10", // 10 mSOL
        "User111111111111111111111111111111111111111",
        true // instant
      );

      expect(quote.receiptAmount).toBe("10");
      expect(quote.protocolFeeUsd).toBeGreaterThan(0); // Instant unstake has fee
      expect(quote.instantWithdrawAvailable).toBe(true);
    });

    it("should calculate delayed unstake quote without fee", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/state")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              tvl_sol: 8000000,
              msol_price: 1.05,
              staking_apy: 0.068,
              instant_unstake_fee: 0.003,
              validators_count: 450,
              msol_supply: 7600000,
            }),
          });
        }
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              base_apy: 0.065,
              mnde_apy: 0.003,
              total_apy: 0.068,
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const quote = await provider.getWithdrawQuote(
        "solana",
        "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
        "10",
        "User111111111111111111111111111111111111111",
        false // delayed
      );

      expect(quote.protocolFeeUsd).toBe(0); // No fee for delayed
      expect(quote.withdrawalDelay).toBe(172800); // ~2 epochs
    });
  });

  describe("buildStakeInstruction", () => {
    it("should return stake instruction parameters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tvl_sol: 8000000,
          msol_price: 1.05,
        }),
      });

      const instruction = await provider.buildStakeInstruction(
        "10",
        "User111111111111111111111111111111111111111"
      );

      expect(instruction.programId).toBe("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
      expect(instruction.lamports).toBe(10000000000n);
      expect(parseFloat(instruction.expectedMSOL)).toBeGreaterThan(0);
    });
  });

  describe("buildInstantUnstakeInstruction", () => {
    it("should return instant unstake parameters with fee", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tvl_sol: 8000000,
          msol_price: 1.05,
          instant_unstake_fee: 0.003,
        }),
      });

      const instruction = await provider.buildInstantUnstakeInstruction(
        "10",
        "User111111111111111111111111111111111111111"
      );

      expect(instruction.programId).toBe("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
      expect(instruction.tokenAmount).toBe(10000000000n);
      expect(instruction.fee).toBe(0.003);
      // Expected SOL should be less than 10.5 due to fee
      expect(parseFloat(instruction.expectedSOL)).toBeLessThan(10.5);
    });
  });

  describe("buildDelayedUnstakeInstruction", () => {
    it("should return delayed unstake parameters with ticket", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tvl_sol: 8000000,
          msol_price: 1.05,
        }),
      });

      const instruction = await provider.buildDelayedUnstakeInstruction(
        "10",
        "User111111111111111111111111111111111111111"
      );

      expect(instruction.programId).toBe("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
      expect(instruction.ticketAccount).toContain("User111111111111111111111111111111111111111");
      expect(instruction.tokenAmount).toBe(10000000000n);
      expect(instruction.unlockEpoch).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("should return Marinade stats", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/state")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              tvl_sol: 8000000,
              msol_price: 1.05,
              staking_apy: 0.068,
              instant_unstake_fee: 0.003,
              validators_count: 450,
            }),
          });
        }
        if (url.includes("/apy")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              base_apy: 0.065,
              mnde_apy: 0.003,
              total_apy: 0.068,
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const stats = await provider.getStats();

      expect(stats.tvlSol).toBe(8000000);
      expect(stats.msolPrice).toBe(1.05);
      expect(stats.apy).toBe(0.068);
      expect(stats.instantUnstakeFee).toBe(0.003);
      expect(stats.validatorsCount).toBe(450);
    });
  });
});
