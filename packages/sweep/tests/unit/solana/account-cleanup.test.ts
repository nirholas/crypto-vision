/**
 * Tests for Solana Account Cleanup Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AccountCleanupService,
  type VacantTokenAccount,
} from "../../../src/services/solana/account-cleanup.js";

// Mock @solana/web3.js
vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "test-blockhash",
      lastValidBlockHeight: 12345678,
    }),
    simulateTransaction: vi.fn().mockResolvedValue({
      value: { err: null, logs: ["Program log: Success"], unitsConsumed: 50000 },
    }),
    sendTransaction: vi.fn().mockResolvedValue("test-signature"),
    sendRawTransaction: vi.fn().mockResolvedValue("test-signature"),
    confirmTransaction: vi.fn().mockResolvedValue({
      value: { err: null },
      context: { slot: 12345 },
    }),
    getTransaction: vi.fn().mockResolvedValue({
      meta: {
        preBalances: [1000000000, 2039280],
        postBalances: [1002039280, 0],
      },
    }),
  })),
  PublicKey: vi.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toString: () => key,
  })),
  VersionedTransaction: vi.fn().mockImplementation(() => ({
    serialize: () => Buffer.from("test-tx"),
    sign: vi.fn(),
    message: { recentBlockhash: "test-blockhash" },
  })),
  TransactionMessage: vi.fn().mockImplementation(() => ({
    compileToV0Message: vi.fn().mockReturnValue({}),
  })),
  Transaction: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    serialize: vi.fn().mockReturnValue(Buffer.from("test-tx")),
    recentBlockhash: "",
    feePayer: null,
  })),
  TransactionInstruction: vi.fn(),
  SystemProgram: {
    transfer: vi.fn().mockReturnValue({}),
  },
  ComputeBudgetProgram: {
    setComputeUnitLimit: vi.fn().mockReturnValue({}),
    setComputeUnitPrice: vi.fn().mockReturnValue({}),
  },
}));

// Mock @solana/spl-token
vi.mock("@solana/spl-token", () => ({
  createCloseAccountInstruction: vi.fn().mockReturnValue({}),
  TOKEN_PROGRAM_ID: { toBase58: () => "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  TOKEN_2022_PROGRAM_ID: { toBase58: () => "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" },
}));

describe("AccountCleanupService", () => {
  let service: AccountCleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountCleanupService("https://api.mainnet-beta.solana.com");
  });

  describe("getCleanupQuote", () => {
    it("should calculate correct quote for vacant accounts", async () => {
      const vacantAccounts: VacantTokenAccount[] = [
        {
          address: "Account1111111111111111111111111111111111111",
          mint: "Mint1111111111111111111111111111111111111111",
          owner: "Owner111111111111111111111111111111111111111",
          rentLamports: 2039280n,
          isToken2022: false,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          address: "Account2222222222222222222222222222222222222",
          mint: "Mint2222222222222222222222222222222222222222",
          owner: "Owner111111111111111111111111111111111111111",
          rentLamports: 2039280n,
          isToken2022: false,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
      ];

      const solPriceUsd = 150;
      const quote = await service.getCleanupQuote(vacantAccounts, solPriceUsd);

      expect(quote.totalAccounts).toBe(2);
      expect(quote.totalRecoverableRent).toBe(4078560n);
      expect(quote.totalRecoverableRentSol).toBeCloseTo(0.00407856);
      expect(quote.totalRecoverableRentUsd).toBeCloseTo(0.611784);
      expect(quote.estimatedTransactions).toBe(1); // 2 accounts < 20 per tx
      expect(quote.netRecoverableLamports).toBeGreaterThan(0n);
    });

    it("should calculate multiple transactions for many accounts", async () => {
      const vacantAccounts: VacantTokenAccount[] = Array.from({ length: 50 }, (_, i) => ({
        address: `Account${i.toString().padStart(38, "0")}`,
        mint: `Mint${i.toString().padStart(40, "0")}`,
        owner: "Owner111111111111111111111111111111111111111",
        rentLamports: 2039280n,
        isToken2022: false,
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      }));

      const quote = await service.getCleanupQuote(vacantAccounts, 150);

      expect(quote.totalAccounts).toBe(50);
      expect(quote.estimatedTransactions).toBe(3); // ceil(50/20) = 3
    });

    it("should handle empty accounts array", async () => {
      const quote = await service.getCleanupQuote([], 150);

      expect(quote.totalAccounts).toBe(0);
      expect(quote.totalRecoverableRent).toBe(0n);
      expect(quote.estimatedTransactions).toBe(0);
    });
  });

  describe("buildCloseInstructions", () => {
    it("should build instructions for each account", () => {
      const { PublicKey } = require("@solana/web3.js");
      const ownerPubkey = new PublicKey("Owner111111111111111111111111111111111111111");

      const vacantAccounts: VacantTokenAccount[] = [
        {
          address: "Account1111111111111111111111111111111111111",
          mint: "Mint1111111111111111111111111111111111111111",
          owner: "Owner111111111111111111111111111111111111111",
          rentLamports: 2039280n,
          isToken2022: false,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          address: "Account2222222222222222222222222222222222222",
          mint: "Mint2222222222222222222222222222222222222222",
          owner: "Owner111111111111111111111111111111111111111",
          rentLamports: 2039280n,
          isToken2022: true,
          programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        },
      ];

      const instructions = service.buildCloseInstructions(vacantAccounts, ownerPubkey);

      expect(instructions).toHaveLength(2);
    });
  });

  describe("createBatchedTransactions", () => {
    it("should batch accounts into groups of 20", async () => {
      const { PublicKey } = require("@solana/web3.js");
      const ownerPubkey = new PublicKey("Owner111111111111111111111111111111111111111");

      const vacantAccounts: VacantTokenAccount[] = Array.from({ length: 25 }, (_, i) => ({
        address: `Account${i.toString().padStart(38, "0")}`,
        mint: `Mint${i.toString().padStart(40, "0")}`,
        owner: "Owner111111111111111111111111111111111111111",
        rentLamports: 2039280n,
        isToken2022: false,
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      }));

      const batches = await service.createBatchedTransactions(vacantAccounts, ownerPubkey);

      expect(batches).toHaveLength(2); // ceil(25/20) = 2
      expect(batches[0].accounts).toHaveLength(20);
      expect(batches[1].accounts).toHaveLength(5);
    });
  });

  describe("getSerializedTransaction", () => {
    it("should return serialized transactions for frontend", async () => {
      const vacantAccounts: VacantTokenAccount[] = [
        {
          address: "Account1111111111111111111111111111111111111",
          mint: "Mint1111111111111111111111111111111111111111",
          owner: "Owner111111111111111111111111111111111111111",
          rentLamports: 2039280n,
          isToken2022: false,
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
      ];

      const result = await service.getSerializedTransaction(
        vacantAccounts,
        "Owner111111111111111111111111111111111111111",
        1000,
        false
      );

      expect(result.batches).toHaveLength(1);
      expect(result.totalTransactions).toBe(1);
      expect(result.totalRent).toBe("2039280");
      expect(result.batches[0].accountsToClose).toContain("Account1111111111111111111111111111111111111");
    });
  });
});
