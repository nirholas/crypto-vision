/**
 * Tests for VersionedTransactionBuilder
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import {
  Connection,
  PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
} from "@solana/web3.js";

// Mock @solana/web3.js
vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  
  const mockConnection = {
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "mock-blockhash-for-testing",
      lastValidBlockHeight: 12345678,
    }),
    getAddressLookupTable: vi.fn().mockResolvedValue({
      value: {
        state: {
          addresses: [
            new actual.PublicKey("11111111111111111111111111111111"),
            new actual.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          ],
        },
      },
    }),
    simulateTransaction: vi.fn().mockResolvedValue({
      value: {
        err: null,
        unitsConsumed: 150000,
        logs: ["Program log: Success"],
      },
    }),
    getMultipleAccountsInfo: vi.fn().mockResolvedValue([
      {
        data: Buffer.from([]),
        owner: new actual.PublicKey("11111111111111111111111111111111"),
        lamports: 1000000,
        executable: false,
        rentEpoch: BigInt(0),
      },
    ]),
  };

  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => mockConnection),
    ComputeBudgetProgram: {
      setComputeUnitLimit: vi.fn().mockReturnValue({
        programId: new actual.PublicKey("ComputeBudget111111111111111111111111111111"),
        keys: [],
        data: Buffer.from([0x02, 0, 0, 0, 0]),
      }),
      setComputeUnitPrice: vi.fn().mockReturnValue({
        programId: new actual.PublicKey("ComputeBudget111111111111111111111111111111"),
        keys: [],
        data: Buffer.from([0x03, 0, 0, 0, 0, 0, 0, 0, 0]),
      }),
    },
    TransactionMessage: {
      compile: vi.fn().mockReturnValue({
        header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
        staticAccountKeys: [],
        recentBlockhash: "mock-blockhash",
        compiledInstructions: [],
      }),
    },
    VersionedTransaction: vi.fn().mockImplementation(() => ({
      signatures: [new Uint8Array(64)],
      message: {
        serialize: vi.fn().mockReturnValue(new Uint8Array(100)),
      },
      serialize: vi.fn().mockReturnValue(new Uint8Array(200)),
    })),
  };
});

// Mock priority fees service
vi.mock("../../../src/services/solana/priority-fees.js", () => ({
  PriorityFeesService: vi.fn().mockImplementation(() => ({
    getRecommendedFee: vi.fn().mockResolvedValue({
      computeUnitLimit: 200000,
      computeUnitPrice: 50000,
      priorityFee: 10000,
    }),
    getPriorityFees: vi.fn().mockResolvedValue({
      low: 1000,
      medium: 10000,
      high: 50000,
      turbo: 100000,
    }),
  })),
}));

// Import after mocking
import { VersionedTransactionBuilder } from "../../../src/services/executor/solana/versioned-tx.js";

describe("VersionedTransactionBuilder", () => {
  let builder: VersionedTransactionBuilder;
  let mockConnection: Connection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection = new Connection("https://api.mainnet-beta.solana.com");
    builder = new VersionedTransactionBuilder(mockConnection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildTransaction", () => {
    it("should build a versioned transaction with instructions", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          keys: [
            { pubkey: signer, isSigner: true, isWritable: true },
          ],
          data: Buffer.from([0x01]),
        },
      ];

      const tx = await builder.buildTransaction({
        instructions,
        signer,
        priorityLevel: "medium",
      });

      expect(tx).toBeDefined();
      expect(ComputeBudgetProgram.setComputeUnitLimit).toHaveBeenCalled();
      expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalled();
      expect(mockConnection.getLatestBlockhash).toHaveBeenCalled();
    });

    it("should include lookup tables when provided", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      const lookupTableAddresses = [
        "GxS6FiQ9RbCPHBAZ6P1Gvi6wXHsSHVqKBepMnoN9u5Yk",
      ];

      const tx = await builder.buildTransaction({
        instructions,
        signer,
        lookupTableAddresses,
        priorityLevel: "high",
      });

      expect(tx).toBeDefined();
      expect(mockConnection.getAddressLookupTable).toHaveBeenCalled();
    });

    it("should use custom compute units when provided", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      await builder.buildTransaction({
        instructions,
        signer,
        computeUnits: 400000,
        priorityLevel: "low",
      });

      expect(ComputeBudgetProgram.setComputeUnitLimit).toHaveBeenCalledWith(
        expect.objectContaining({ units: 400000 })
      );
    });

    it("should use custom compute unit price when provided", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      await builder.buildTransaction({
        instructions,
        signer,
        computeUnitPrice: 100000,
      });

      expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalledWith(
        expect.objectContaining({ microLamports: 100000 })
      );
    });
  });

  describe("estimateComputeUnits", () => {
    it("should estimate compute units via simulation", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      const estimate = await builder.estimateComputeUnits(instructions, signer);

      expect(estimate).toBeGreaterThan(0);
      expect(mockConnection.simulateTransaction).toHaveBeenCalled();
    });

    it("should add buffer to estimated compute units", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      // Mock returns 150000 consumed
      const estimate = await builder.estimateComputeUnits(instructions, signer);

      // Should add 10% buffer
      expect(estimate).toBeGreaterThanOrEqual(150000);
      expect(estimate).toBeLessThanOrEqual(200000);
    });

    it("should return default on simulation failure", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [];

      (mockConnection.simulateTransaction as Mock).mockResolvedValueOnce({
        value: { err: { InstructionError: [0, "Custom"] } },
      });

      const estimate = await builder.estimateComputeUnits(instructions, signer);

      // Should return default
      expect(estimate).toBe(200000);
    });
  });

  describe("getLookupTables", () => {
    it("should fetch and return lookup table accounts", async () => {
      const addresses = [
        "GxS6FiQ9RbCPHBAZ6P1Gvi6wXHsSHVqKBepMnoN9u5Yk",
        "4syr5pBaboZy4cZyF6sys82uGD7jEvoAP2ZMaoich4fZ",
      ];

      const tables = await builder.getLookupTables(addresses);

      expect(tables).toHaveLength(2);
      expect(mockConnection.getAddressLookupTable).toHaveBeenCalledTimes(2);
    });

    it("should filter out null lookup tables", async () => {
      (mockConnection.getAddressLookupTable as Mock).mockResolvedValueOnce({
        value: null,
      });
      (mockConnection.getAddressLookupTable as Mock).mockResolvedValueOnce({
        value: {
          state: {
            addresses: [new PublicKey("11111111111111111111111111111111")],
          },
        },
      });

      const tables = await builder.getLookupTables([
        "InvalidTable111111111111111111111111111111",
        "ValidTable11111111111111111111111111111111",
      ]);

      expect(tables).toHaveLength(1);
    });
  });

  describe("serializeTransaction", () => {
    it("should serialize transaction to base64", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      const tx = await builder.buildTransaction({
        instructions,
        signer,
      });

      const serialized = builder.serializeTransaction(tx);

      expect(typeof serialized).toBe("string");
      // Should be base64 encoded
      expect(() => Buffer.from(serialized, "base64")).not.toThrow();
    });
  });

  describe("buildComputeBudgetInstructions", () => {
    it("should create compute budget instructions", () => {
      const instructions = builder.buildComputeBudgetInstructions(300000, 75000);

      expect(instructions).toHaveLength(2);
      expect(ComputeBudgetProgram.setComputeUnitLimit).toHaveBeenCalledWith({
        units: 300000,
      });
      expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalledWith({
        microLamports: 75000,
      });
    });
  });

  describe("simulateTransaction", () => {
    it("should simulate transaction and return result", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      const tx = await builder.buildTransaction({
        instructions,
        signer,
      });

      const result = await builder.simulateTransaction(tx);

      expect(result.success).toBe(true);
      expect(result.unitsConsumed).toBe(150000);
      expect(result.logs).toBeDefined();
    });

    it("should return error on simulation failure", async () => {
      (mockConnection.simulateTransaction as Mock).mockResolvedValueOnce({
        value: {
          err: { InstructionError: [0, "InsufficientFunds"] },
          logs: ["Program failed: insufficient funds"],
        },
      });

      const signer = new PublicKey("11111111111111111111111111111111");
      const tx = await builder.buildTransaction({
        instructions: [],
        signer,
      });

      const result = await builder.simulateTransaction(tx);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("priority levels", () => {
    it("should use correct compute unit prices for each priority level", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("11111111111111111111111111111111"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      const priorityLevels = ["low", "medium", "high", "turbo"] as const;

      for (const level of priorityLevels) {
        vi.clearAllMocks();
        
        await builder.buildTransaction({
          instructions,
          signer,
          priorityLevel: level,
        });

        expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalled();
      }
    });
  });

  describe("Jupiter lookup tables", () => {
    it("should include Jupiter lookup tables when requested", async () => {
      const signer = new PublicKey("11111111111111111111111111111111");
      const instructions: TransactionInstruction[] = [
        {
          programId: new PublicKey("JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB"),
          keys: [],
          data: Buffer.from([]),
        },
      ];

      await builder.buildTransaction({
        instructions,
        signer,
        includeJupiterLookupTables: true,
      });

      expect(mockConnection.getAddressLookupTable).toHaveBeenCalled();
    });
  });
});
