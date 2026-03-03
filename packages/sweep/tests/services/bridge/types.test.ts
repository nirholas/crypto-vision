/**
 * Bridge Types Tests
 */

import { describe, it, expect } from "vitest";
import {
  BridgeProvider,
  BridgeStatus,
  BRIDGE_CONFIG,
  BRIDGE_PROTOCOL_INFO,
  type BridgeQuote,
  type BridgeQuoteRequest,
  type BridgeTransaction,
  type BridgeReceipt,
  type BridgeFees,
  type BridgeStep,
} from "../../../src/services/bridge/types.js";

describe("Bridge Types", () => {
  describe("BridgeProvider enum", () => {
    it("should have all expected providers", () => {
      expect(BridgeProvider.ACROSS).toBe("across");
      expect(BridgeProvider.STARGATE).toBe("stargate");
      expect(BridgeProvider.HOP).toBe("hop");
      expect(BridgeProvider.CBRIDGE).toBe("cbridge");
      expect(BridgeProvider.SOCKET).toBe("socket");
      expect(BridgeProvider.SYNAPSE).toBe("synapse");
    });
  });

  describe("BridgeStatus enum", () => {
    it("should have all expected statuses", () => {
      expect(BridgeStatus.PENDING).toBe("pending");
      expect(BridgeStatus.PENDING_SOURCE).toBe("pending_source");
      expect(BridgeStatus.SOURCE_CONFIRMED).toBe("source_confirmed");
      expect(BridgeStatus.BRIDGING).toBe("bridging");
      expect(BridgeStatus.DESTINATION_PENDING).toBe("destination_pending");
      expect(BridgeStatus.PENDING_DEST).toBe("pending_dest");
      expect(BridgeStatus.COMPLETED).toBe("completed");
      expect(BridgeStatus.FAILED).toBe("failed");
      expect(BridgeStatus.REFUNDED).toBe("refunded");
      expect(BridgeStatus.EXPIRED).toBe("expired");
    });
  });

  describe("BRIDGE_CONFIG", () => {
    it("should have default slippage configured", () => {
      expect(BRIDGE_CONFIG.DEFAULT_SLIPPAGE).toBe(0.005);
    });

    it("should have minimum output value configured", () => {
      expect(BRIDGE_CONFIG.MIN_OUTPUT_VALUE_USD).toBe(1);
    });

    it("should have quote TTL configured", () => {
      expect(BRIDGE_CONFIG.QUOTE_TTL_SECONDS).toBe(60);
    });

    it("should have USDC addresses for all chains", () => {
      expect(BRIDGE_CONFIG.USDC_ADDRESSES.ethereum).toBeDefined();
      expect(BRIDGE_CONFIG.USDC_ADDRESSES.base).toBeDefined();
      expect(BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum).toBeDefined();
      expect(BRIDGE_CONFIG.USDC_ADDRESSES.polygon).toBeDefined();
      expect(BRIDGE_CONFIG.USDC_ADDRESSES.optimism).toBeDefined();
    });

    it("should have WETH addresses for all chains", () => {
      expect(BRIDGE_CONFIG.WETH_ADDRESSES.ethereum).toBeDefined();
      expect(BRIDGE_CONFIG.WETH_ADDRESSES.base).toBeDefined();
      expect(BRIDGE_CONFIG.WETH_ADDRESSES.arbitrum).toBeDefined();
    });

    it("should have DAI addresses", () => {
      expect(BRIDGE_CONFIG.DAI_ADDRESSES.ethereum).toBeDefined();
      expect(BRIDGE_CONFIG.DAI_ADDRESSES.arbitrum).toBeDefined();
    });

    it("should have USDT addresses", () => {
      expect(BRIDGE_CONFIG.USDT_ADDRESSES.ethereum).toBeDefined();
      expect(BRIDGE_CONFIG.USDT_ADDRESSES.arbitrum).toBeDefined();
    });
  });

  describe("BRIDGE_PROTOCOL_INFO", () => {
    it("should have info for all providers", () => {
      expect(BRIDGE_PROTOCOL_INFO[BridgeProvider.ACROSS]).toBeDefined();
      expect(BRIDGE_PROTOCOL_INFO[BridgeProvider.STARGATE]).toBeDefined();
      expect(BRIDGE_PROTOCOL_INFO[BridgeProvider.HOP]).toBeDefined();
      expect(BRIDGE_PROTOCOL_INFO[BridgeProvider.CBRIDGE]).toBeDefined();
      expect(BRIDGE_PROTOCOL_INFO[BridgeProvider.SOCKET]).toBeDefined();
    });

    it("should have correct info for Across", () => {
      const acrossInfo = BRIDGE_PROTOCOL_INFO[BridgeProvider.ACROSS];
      expect(acrossInfo.protocol).toBe(BridgeProvider.ACROSS);
      expect(acrossInfo.name).toBe("Across Protocol");
      expect(acrossInfo.isAggregator).toBe(false);
      expect(acrossInfo.supportedChains).toContain("ethereum");
      expect(acrossInfo.supportedChains).toContain("arbitrum");
    });

    it("should mark Socket as an aggregator", () => {
      const socketInfo = BRIDGE_PROTOCOL_INFO[BridgeProvider.SOCKET];
      expect(socketInfo.isAggregator).toBe(true);
    });
  });

  describe("Type validation", () => {
    it("should validate BridgeQuoteRequest structure", () => {
      const request: BridgeQuoteRequest = {
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
        slippage: 0.005,
        priority: "speed",
      };

      expect(request.sourceChain).toBe("ethereum");
      expect(request.destinationChain).toBe("arbitrum");
      expect(request.amount).toBe(1000000000n);
    });

    it("should validate BridgeFees structure", () => {
      const fees: BridgeFees = {
        bridgeFee: 100000n,
        gasFee: 50000n,
        relayerFee: 25000n,
        totalFeeUsd: 0.5,
        lpFee: 10000n,
      };

      expect(fees.bridgeFee).toBe(100000n);
      expect(fees.totalFeeUsd).toBe(0.5);
    });

    it("should validate BridgeStep structure", () => {
      const step: BridgeStep = {
        type: "bridge",
        chain: "ethereum",
        protocol: "Across",
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        fromAmount: "1000000000",
        toAmount: "999000000",
        amount: 1000000000n,
        expectedOutput: 999000000n,
      };

      expect(step.type).toBe("bridge");
      expect(step.chain).toBe("ethereum");
      expect(step.protocol).toBe("Across");
    });

    it("should allow valid step types", () => {
      const stepTypes: BridgeStep["type"][] = ["swap", "bridge", "approve", "wrap", "unwrap"];
      
      stepTypes.forEach((type) => {
        const step: BridgeStep = {
          type,
          chain: "ethereum",
          protocol: "Test",
          fromToken: "0x1234567890123456789012345678901234567890",
          toToken: "0x1234567890123456789012345678901234567890",
          fromAmount: "1000000000",
          toAmount: "999000000",
          amount: 1000000000n,
          expectedOutput: 999000000n,
        };
        expect(step.type).toBe(type);
      });
    });
  });
});
