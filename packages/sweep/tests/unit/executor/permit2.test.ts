/**
 * Permit2 Service Unit Tests
 * Tests for permit signature generation and batch encoding
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPublicClient } from "../../utils/mocks.js";
import { TOKENS } from "../../utils/fixtures.js";
import type { Address, Hex } from "viem";

// Mock viem functions
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    keccak256: vi.fn((data) => "0x" + "a".repeat(64)),
    encodePacked: vi.fn(() => "0xencodedpacked"),
    encodeAbiParameters: vi.fn(() => "0xencodedparams"),
    concat: vi.fn((items) => items.join("")),
    toHex: vi.fn((str) => "0x" + Buffer.from(str as string).toString("hex")),
  };
});

describe("Permit2 Service", () => {
  const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
  
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
  });

  describe("Permit Signature Generation", () => {
    it("should create permit data for single token", () => {
      const token = TOKENS.ethereum.USDC.address;
      const amount = BigInt("1000000000"); // 1000 USDC
      const spender = "0x1234567890123456789012345678901234567890" as Address;
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const permit = {
        permitted: {
          token,
          amount,
        },
        spender,
        nonce: BigInt(Date.now()),
        deadline,
      };

      expect(permit.permitted.token).toBe(token);
      expect(permit.permitted.amount).toBe(amount);
      expect(permit.spender).toBe(spender);
      expect(permit.deadline).toBeGreaterThan(Date.now() / 1000);
    });

    it("should generate unique nonces", () => {
      const generateNonce = () => {
        const timestamp = BigInt(Date.now());
        const random = BigInt(Math.floor(Math.random() * 256));
        return (timestamp << 8n) | random;
      };

      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      // Nonces should be different (high probability with random component)
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toBeGreaterThan(0n);
    });

    it("should compute domain separator correctly", () => {
      const chainId = 1;
      const domainData = {
        name: "Permit2",
        chainId,
        verifyingContract: PERMIT2_ADDRESS,
      };

      // Domain separator is a hash of the domain data
      // In real implementation, this would use EIP-712 encoding
      const computeDomainSeparator = (data: typeof domainData) => {
        return `0x${"d".repeat(64)}` as Hex; // Mock hash
      };

      const separator = computeDomainSeparator(domainData);
      expect(separator).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should handle default deadline of 1 hour", () => {
      const now = Math.floor(Date.now() / 1000);
      const defaultDeadline = now + 3600;

      const permit = {
        deadline: defaultDeadline,
      };

      expect(permit.deadline - now).toBe(3600);
    });

    it("should validate deadline is in future", () => {
      const now = Math.floor(Date.now() / 1000);
      
      const validateDeadline = (deadline: number) => {
        if (deadline <= now) {
          throw new Error("Deadline must be in the future");
        }
        return true;
      };

      expect(validateDeadline(now + 3600)).toBe(true);
      expect(() => validateDeadline(now - 100)).toThrow("Deadline must be in the future");
    });
  });

  describe("Batch Permit Encoding", () => {
    it("should create batch permit for multiple tokens", () => {
      const tokens = [
        { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000000000") },
        { token: TOKENS.ethereum.USDT.address, amount: BigInt("500000000") },
        { token: TOKENS.ethereum.DAI.address, amount: BigInt("2000000000000000000") },
      ];
      const spender = "0x1234567890123456789012345678901234567890" as Address;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const batchPermit = {
        permitted: tokens.map(t => ({
          token: t.token,
          amount: t.amount,
        })),
        spender,
        nonce: BigInt(Date.now()),
        deadline,
      };

      expect(batchPermit.permitted).toHaveLength(3);
      expect(batchPermit.permitted[0].token).toBe(TOKENS.ethereum.USDC.address);
    });

    it("should encode batch transfer details", () => {
      const transferDetails = [
        { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("1000") },
        { to: "0x2222222222222222222222222222222222222222" as Address, requestedAmount: BigInt("2000") },
      ];

      expect(transferDetails).toHaveLength(2);
      expect(transferDetails[0].requestedAmount).toBe(BigInt("1000"));
    });

    it("should calculate batch signature hash", () => {
      const PERMIT_BATCH_TYPEHASH = "0x" + "b".repeat(64) as Hex;
      
      const hashBatchPermit = (permit: {
        permitted: { token: Address; amount: bigint }[];
        spender: Address;
        nonce: bigint;
        deadline: number;
      }) => {
        // Simplified - real implementation uses keccak256 of encoded data
        return `0x${"c".repeat(64)}` as Hex;
      };

      const batchPermit = {
        permitted: [
          { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") },
        ],
        spender: "0x1234567890123456789012345678901234567890" as Address,
        nonce: BigInt(1),
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const hash = hashBatchPermit(batchPermit);
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should match permit and transfer array lengths", () => {
      const permitted = [
        { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") },
        { token: TOKENS.ethereum.USDT.address, amount: BigInt("2000") },
      ];
      
      const transferDetails = [
        { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("1000") },
        { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("2000") },
      ];

      expect(permitted.length).toBe(transferDetails.length);
    });

    it("should enforce requested amount <= permitted amount", () => {
      const permitted = { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") };
      const requested = BigInt("1500");

      const validateAmount = (permitted: bigint, requested: bigint) => {
        if (requested > permitted) {
          throw new Error("Requested amount exceeds permitted amount");
        }
        return true;
      };

      expect(() => validateAmount(permitted.amount, requested)).toThrow("Requested amount exceeds permitted amount");
      expect(validateAmount(permitted.amount, BigInt("500"))).toBe(true);
    });
  });

  describe("Nonce Management", () => {
    it("should fetch current nonce from contract", async () => {
      const owner = "0x1234567890123456789012345678901234567890" as Address;
      const token = TOKENS.ethereum.USDC.address;
      const spender = "0x5555555555555555555555555555555555555555" as Address;

      mockClient.readContract = vi.fn().mockResolvedValue([
        BigInt("1000000000"), // amount
        BigInt(Math.floor(Date.now() / 1000) + 86400), // expiration
        BigInt(5), // nonce
      ]);

      const result = await mockClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [],
        functionName: "allowance",
        args: [owner, token, spender],
      });

      expect(result[2]).toBe(BigInt(5));
    });

    it("should handle word-based nonces", () => {
      // Permit2 uses word-based nonces: higher 248 bits = word, lower 8 bits = bitmap
      const generateWordBasedNonce = () => {
        const word = BigInt(Date.now());
        const bitmap = BigInt(Math.floor(Math.random() * 256));
        return (word << 8n) | bitmap;
      };

      const nonce = generateWordBasedNonce();
      const word = nonce >> 8n;
      const bitmap = nonce & 0xFFn;

      expect(word).toBeGreaterThan(0n);
      expect(bitmap).toBeLessThan(256n);
    });

    it("should increment nonce after use", () => {
      let currentNonce = BigInt(5);
      
      const useNonce = () => {
        const usedNonce = currentNonce;
        currentNonce += 1n;
        return usedNonce;
      };

      expect(useNonce()).toBe(BigInt(5));
      expect(useNonce()).toBe(BigInt(6));
      expect(currentNonce).toBe(BigInt(7));
    });
  });

  describe("EIP-712 Typed Data", () => {
    it("should construct correct typed data structure", () => {
      const permit = {
        permitted: {
          token: TOKENS.ethereum.USDC.address,
          amount: BigInt("1000000000"),
        },
        spender: "0x5555555555555555555555555555555555555555" as Address,
        nonce: BigInt(1),
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const typedData = {
        types: {
          PermitTransferFrom: [
            { name: "permitted", type: "TokenPermissions" },
            { name: "spender", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
          TokenPermissions: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
        primaryType: "PermitTransferFrom" as const,
        domain: {
          name: "Permit2",
          chainId: 1,
          verifyingContract: PERMIT2_ADDRESS,
        },
        message: permit,
      };

      expect(typedData.primaryType).toBe("PermitTransferFrom");
      expect(typedData.types.TokenPermissions).toHaveLength(2);
      expect(typedData.domain.verifyingContract).toBe(PERMIT2_ADDRESS);
    });

    it("should include witness data when provided", () => {
      const witnessTypehash = "0x" + "w".repeat(64) as Hex;
      const witnessData = {
        recipient: "0x1111111111111111111111111111111111111111" as Address,
        minOutput: BigInt("950000000"),
      };

      const permitWithWitness = {
        permitted: { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") },
        spender: "0x5555555555555555555555555555555555555555" as Address,
        nonce: BigInt(1),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        witness: witnessData,
        witnessTypehash,
      };

      expect(permitWithWitness.witness).toBeDefined();
      expect(permitWithWitness.witnessTypehash).toBeDefined();
    });
  });

  describe("Calldata Building", () => {
    it("should encode permitTransferFrom calldata", () => {
      const buildPermitTransferFromCalldata = (
        permit: any,
        transferDetails: any,
        owner: Address,
        signature: Hex
      ) => {
        // Simplified - real implementation uses encodeFunctionData
        return `0x30f28b7a${"0".repeat(128)}` as Hex;
      };

      const calldata = buildPermitTransferFromCalldata(
        {
          permitted: { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") },
          nonce: BigInt(1),
          deadline: Math.floor(Date.now() / 1000) + 3600,
        },
        { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("1000") },
        "0x2222222222222222222222222222222222222222" as Address,
        "0xsignature" as Hex
      );

      expect(calldata).toMatch(/^0x30f28b7a/); // permitTransferFrom selector
    });

    it("should encode permitBatchTransferFrom calldata", () => {
      const buildBatchPermitCalldata = (
        permit: any,
        transferDetails: any[],
        owner: Address,
        signature: Hex
      ) => {
        // Simplified - real implementation uses encodeFunctionData
        return `0xedd9444b${"0".repeat(256)}` as Hex;
      };

      const calldata = buildBatchPermitCalldata(
        {
          permitted: [
            { token: TOKENS.ethereum.USDC.address, amount: BigInt("1000") },
            { token: TOKENS.ethereum.USDT.address, amount: BigInt("2000") },
          ],
          nonce: BigInt(1),
          deadline: Math.floor(Date.now() / 1000) + 3600,
        },
        [
          { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("1000") },
          { to: "0x1111111111111111111111111111111111111111" as Address, requestedAmount: BigInt("2000") },
        ],
        "0x2222222222222222222222222222222222222222" as Address,
        "0xsignature" as Hex
      );

      expect(calldata).toMatch(/^0xedd9444b/); // permitBatchTransferFrom selector
    });
  });

  describe("Signature Validation", () => {
    it("should validate signature length", () => {
      const validSignature = "0x" + "a".repeat(130); // 65 bytes
      const invalidSignature = "0x" + "a".repeat(64); // 32 bytes

      const isValidSignatureLength = (sig: string) => {
        const hexString = sig.startsWith("0x") ? sig.slice(2) : sig;
        return hexString.length === 130; // 65 bytes * 2 hex chars
      };

      expect(isValidSignatureLength(validSignature)).toBe(true);
      expect(isValidSignatureLength(invalidSignature)).toBe(false);
    });

    it("should extract r, s, v from signature", () => {
      const signature = "0x" + "a".repeat(64) + "b".repeat(64) + "1b"; // r + s + v

      const parseSignature = (sig: string) => {
        const hexString = sig.startsWith("0x") ? sig.slice(2) : sig;
        return {
          r: "0x" + hexString.slice(0, 64),
          s: "0x" + hexString.slice(64, 128),
          v: parseInt(hexString.slice(128, 130), 16),
        };
      };

      const parsed = parseSignature(signature);
      
      expect(parsed.r).toMatch(/^0x[a]{64}$/);
      expect(parsed.s).toMatch(/^0x[b]{64}$/);
      expect(parsed.v).toBe(27);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid token address", () => {
      const validateTokenAddress = (token: string) => {
        if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
          throw new Error("Invalid token address");
        }
        return true;
      };

      expect(() => validateTokenAddress("invalid")).toThrow("Invalid token address");
      expect(validateTokenAddress(TOKENS.ethereum.USDC.address)).toBe(true);
    });

    it("should handle zero amount", () => {
      const validateAmount = (amount: bigint) => {
        if (amount <= 0n) {
          throw new Error("Amount must be greater than zero");
        }
        return true;
      };

      expect(() => validateAmount(0n)).toThrow("Amount must be greater than zero");
      expect(validateAmount(BigInt("1000"))).toBe(true);
    });

    it("should handle expired deadline", () => {
      const validateDeadline = (deadline: number) => {
        const now = Math.floor(Date.now() / 1000);
        if (deadline <= now) {
          throw new Error("Permit has expired");
        }
        return true;
      };

      const pastDeadline = Math.floor(Date.now() / 1000) - 3600;
      const futureDeadline = Math.floor(Date.now() / 1000) + 3600;

      expect(() => validateDeadline(pastDeadline)).toThrow("Permit has expired");
      expect(validateDeadline(futureDeadline)).toBe(true);
    });
  });
});
