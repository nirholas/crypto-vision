import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";
import { type Address, type Hex } from "viem";

// Mock viem functions before importing
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    verifyTypedData: vi.fn(),
    hashTypedData: vi.fn(),
    recoverAddress: vi.fn(),
  };
});

import {
  SpendPermissionsService,
  parseStoredSpendPermission,
  serializeSpendPermission,
  createUsdcSpendPermission,
} from "../../../src/services/subscriptions/spend-permissions.js";
import {
  type SpendPermission,
  type SignedSpendPermission,
  SPEND_PERMISSION_MANAGER,
  SWEEP_EXECUTOR_ADDRESS,
} from "../../../src/services/subscriptions/types.js";
import { verifyTypedData, hashTypedData } from "viem";

describe("SpendPermissionsService", () => {
  const mockPublicClient = {
    readContract: vi.fn(),
  };

  let service: SpendPermissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpendPermissionsService(
      mockPublicClient as any,
      8453 // Base
    );
  });

  describe("getManagerAddress", () => {
    it("should return the correct manager address for Base", () => {
      const address = service.getManagerAddress();
      expect(address).toBe(SPEND_PERMISSION_MANAGER[8453]);
    });

    it("should throw for unsupported chain", () => {
      const unsupportedService = new SpendPermissionsService(
        mockPublicClient as any,
        999999
      );
      expect(() => unsupportedService.getManagerAddress()).toThrow(
        "SpendPermissionManager not deployed on chain 999999"
      );
    });
  });

  describe("createSpendPermissionRequest", () => {
    it("should create a valid spend permission request", () => {
      const permission = service.createSpendPermissionRequest({
        account: "0x1234567890123456789012345678901234567890" as Address,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        maxAmountPerPeriod: BigInt("1000000000"), // 1000 USDC (6 decimals)
        periodSeconds: 86400, // 1 day
        expiryTimestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        sourceChainIds: [8453, 42161],
      });

      expect(permission.account).toBe("0x1234567890123456789012345678901234567890");
      expect(permission.spender).toBe(SWEEP_EXECUTOR_ADDRESS);
      expect(permission.token).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(permission.allowance).toBe(BigInt("1000000000"));
      expect(permission.period).toBe(86400);
      expect(permission.extraData).toBeDefined();
    });

    it("should set start time to current timestamp", () => {
      const beforeCreate = Math.floor(Date.now() / 1000);
      
      const permission = service.createSpendPermissionRequest({
        account: "0x1234567890123456789012345678901234567890" as Address,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        maxAmountPerPeriod: BigInt("1000000000"),
        periodSeconds: 86400,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        sourceChainIds: [8453],
      });

      const afterCreate = Math.floor(Date.now() / 1000);
      
      expect(permission.start).toBeGreaterThanOrEqual(beforeCreate);
      expect(permission.start).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe("buildSpendPermissionTypedData", () => {
    it("should build correct EIP-712 typed data", () => {
      const permission: SpendPermission = {
        account: "0x1234567890123456789012345678901234567890" as Address,
        spender: SWEEP_EXECUTOR_ADDRESS,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        allowance: BigInt("1000000000"),
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: BigInt("12345"),
        extraData: "0x" as Hex,
      };

      const typedData = service.buildSpendPermissionTypedData(permission);

      expect(typedData.domain.name).toBe("SpendPermissionManager");
      expect(typedData.domain.version).toBe("1");
      expect(typedData.domain.chainId).toBe(8453);
      expect(typedData.domain.verifyingContract).toBe(SPEND_PERMISSION_MANAGER[8453]);
      expect(typedData.primaryType).toBe("SpendPermission");
      expect(typedData.message.account).toBe(permission.account);
      expect(typedData.message.spender).toBe(permission.spender);
    });
  });

  describe("validateSpendPermissionSignature", () => {
    it("should validate a correct signature", async () => {
      const permission: SpendPermission = {
        account: "0x1234567890123456789012345678901234567890" as Address,
        spender: SWEEP_EXECUTOR_ADDRESS,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        allowance: BigInt("1000000000"),
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: BigInt("12345"),
        extraData: "0x" as Hex,
      };

      const signedPermission: SignedSpendPermission = {
        permission,
        signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b" as Hex,
      };

      (verifyTypedData as Mock).mockResolvedValue(true);
      mockPublicClient.readContract.mockResolvedValue(true);

      const isValid = await service.validateSpendPermissionSignature(signedPermission);

      expect(isValid).toBe(true);
      expect(verifyTypedData).toHaveBeenCalled();
    });

    it("should return false for invalid signature", async () => {
      const permission: SpendPermission = {
        account: "0x1234567890123456789012345678901234567890" as Address,
        spender: SWEEP_EXECUTOR_ADDRESS,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        allowance: BigInt("1000000000"),
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: BigInt("12345"),
        extraData: "0x" as Hex,
      };

      const signedPermission: SignedSpendPermission = {
        permission,
        signature: "0xbad_signature" as Hex,
      };

      (verifyTypedData as Mock).mockResolvedValue(false);

      const isValid = await service.validateSpendPermissionSignature(signedPermission);

      expect(isValid).toBe(false);
    });
  });

  describe("getSpendPermissionStatus", () => {
    const permission: SpendPermission = {
      account: "0x1234567890123456789012345678901234567890" as Address,
      spender: SWEEP_EXECUTOR_ADDRESS,
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
      allowance: BigInt("1000000000"),
      period: 86400,
      start: Math.floor(Date.now() / 1000) - 3600, // Started 1 hour ago
      end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      salt: BigInt("12345"),
      extraData: "0x" as Hex,
    };

    beforeEach(() => {
      (hashTypedData as Mock).mockReturnValue("0xhash" as Hex);
    });

    it("should return valid status for active permission", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(false) // isRevoked
        .mockResolvedValueOnce([permission.start, permission.start + permission.period]) // getCurrentPeriod
        .mockResolvedValueOnce(BigInt("0")); // getSpendUsage

      const status = await service.getSpendPermissionStatus(permission);

      expect(status.isValid).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.isRevoked).toBe(false);
      expect(status.remainingAllowance).toBe(permission.allowance);
    });

    it("should return invalid for expired permission", async () => {
      const expiredPermission: SpendPermission = {
        ...permission,
        end: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      mockPublicClient.readContract.mockResolvedValueOnce(false);

      const status = await service.getSpendPermissionStatus(expiredPermission);

      expect(status.isValid).toBe(false);
      expect(status.isExpired).toBe(true);
    });

    it("should return invalid for not-yet-started permission", async () => {
      const futurePermission: SpendPermission = {
        ...permission,
        start: Math.floor(Date.now() / 1000) + 3600, // Starts in 1 hour
      };

      const status = await service.getSpendPermissionStatus(futurePermission);

      expect(status.isValid).toBe(false);
    });

    it("should calculate remaining allowance correctly", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(false) // isRevoked
        .mockResolvedValueOnce([permission.start, permission.start + permission.period]) // getCurrentPeriod
        .mockResolvedValueOnce(BigInt("300000000")); // getSpendUsage - used 300 USDC

      const status = await service.getSpendPermissionStatus(permission);

      expect(status.usedInPeriod).toBe(BigInt("300000000"));
      expect(status.remainingAllowance).toBe(BigInt("700000000")); // 1000 - 300
    });
  });

  describe("hasEnoughAllowance", () => {
    const permission: SpendPermission = {
      account: "0x1234567890123456789012345678901234567890" as Address,
      spender: SWEEP_EXECUTOR_ADDRESS,
      token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
      allowance: BigInt("1000000000"),
      period: 86400,
      start: Math.floor(Date.now() / 1000) - 3600,
      end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      salt: BigInt("12345"),
      extraData: "0x" as Hex,
    };

    beforeEach(() => {
      (hashTypedData as Mock).mockReturnValue("0xhash" as Hex);
    });

    it("should return true when enough allowance", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([permission.start, permission.start + permission.period])
        .mockResolvedValueOnce(BigInt("0"));

      const hasEnough = await service.hasEnoughAllowance(
        permission,
        BigInt("500000000")
      );

      expect(hasEnough).toBe(true);
    });

    it("should return false when not enough allowance", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([permission.start, permission.start + permission.period])
        .mockResolvedValueOnce(BigInt("900000000")); // Used 900, only 100 remaining

      const hasEnough = await service.hasEnoughAllowance(
        permission,
        BigInt("500000000")
      );

      expect(hasEnough).toBe(false);
    });
  });
});

describe("Helper Functions", () => {
  describe("parseStoredSpendPermission", () => {
    it("should parse stored permission data correctly", () => {
      const storedData = {
        account: "0x1234567890123456789012345678901234567890",
        spender: "0x0987654321098765432109876543210987654321",
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        allowance: "1000000000",
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: "12345",
        extraData: "0x",
      };

      const permission = parseStoredSpendPermission(storedData);

      expect(permission.account).toBe(storedData.account);
      expect(permission.allowance).toBe(BigInt("1000000000"));
      expect(permission.salt).toBe(BigInt("12345"));
    });
  });

  describe("serializeSpendPermission", () => {
    it("should serialize permission for storage", () => {
      const permission: SpendPermission = {
        account: "0x1234567890123456789012345678901234567890" as Address,
        spender: "0x0987654321098765432109876543210987654321" as Address,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        allowance: BigInt("1000000000"),
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: BigInt("12345"),
        extraData: "0x" as Hex,
      };

      const serialized = serializeSpendPermission(permission);

      expect(serialized.account).toBe(permission.account);
      expect(serialized.allowance).toBe("1000000000");
      expect(serialized.salt).toBe("12345");
    });

    it("should roundtrip correctly", () => {
      const permission: SpendPermission = {
        account: "0x1234567890123456789012345678901234567890" as Address,
        spender: "0x0987654321098765432109876543210987654321" as Address,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
        allowance: BigInt("1000000000"),
        period: 86400,
        start: 1700000000,
        end: 1702592000,
        salt: BigInt("12345"),
        extraData: "0x" as Hex,
      };

      const serialized = serializeSpendPermission(permission);
      const parsed = parseStoredSpendPermission(serialized);

      expect(parsed.account).toBe(permission.account);
      expect(parsed.allowance).toBe(permission.allowance);
      expect(parsed.salt).toBe(permission.salt);
      expect(parsed.period).toBe(permission.period);
    });
  });

  describe("createUsdcSpendPermission", () => {
    it("should create USDC permission for Base", () => {
      const permission = createUsdcSpendPermission(
        8453, // Base
        "0x1234567890123456789012345678901234567890" as Address,
        BigInt("1000000000"),
        1, // 1 day period
        30, // 30 day expiry
        [8453, 42161]
      );

      expect(permission.token).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(permission.period).toBe(86400);
    });

    it("should throw for unsupported chain", () => {
      expect(() =>
        createUsdcSpendPermission(
          999999,
          "0x1234567890123456789012345678901234567890" as Address,
          BigInt("1000000000"),
          1,
          30,
          [8453]
        )
      ).toThrow("USDC not configured for chain 999999");
    });
  });
});
