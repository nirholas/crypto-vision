/**
 * Tests for lib/anomaly-processors.ts — data feed processors
 *
 * Validates that processPrice, processTVL, processStablecoinPrice,
 * processGas, processDerivatives, and processExchangeFlow correctly
 * feed the anomaly engine for detection.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    processDerivatives,
    processExchangeFlow,
    processGas,
    processPrice,
    processStablecoinPrice,
    processTVL,
} from "../../src/lib/anomaly-processors.js";
import { anomalyEngine } from "../../src/lib/anomaly.js";

describe("Anomaly Processors", () => {
    beforeEach(() => {
        anomalyEngine.reset();
    });

    describe("processPrice", () => {
        it("feeds price data into both spike and crash detectors", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processPrice("bitcoin", 50000);
            expect(spy).toHaveBeenCalledWith("price_spike", "bitcoin", "price_usd", 50000);
            expect(spy).toHaveBeenCalledWith("price_crash", "bitcoin", "price_usd", 50000);
            spy.mockRestore();
        });

        it("feeds volume data when provided", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processPrice("bitcoin", 50000, 1_000_000);
            expect(spy).toHaveBeenCalledWith("volume_surge", "bitcoin", "volume_24h", 1_000_000);
            expect(spy).toHaveBeenCalledWith("volume_drop", "bitcoin", "volume_24h", 1_000_000);
            spy.mockRestore();
        });

        it("skips volume detection when volume is undefined", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processPrice("bitcoin", 50000);
            const volumeCalls = spy.mock.calls.filter(
                (c) => c[0] === "volume_surge" || c[0] === "volume_drop",
            );
            expect(volumeCalls.length).toBe(0);
            spy.mockRestore();
        });

        it("skips volume detection when volume is 0", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processPrice("bitcoin", 50000, 0);
            const volumeCalls = spy.mock.calls.filter(
                (c) => c[0] === "volume_surge" || c[0] === "volume_drop",
            );
            expect(volumeCalls.length).toBe(0);
            spy.mockRestore();
        });
    });

    describe("processTVL", () => {
        it("feeds TVL into drain and surge detectors", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processTVL("aave", 10_000_000);
            expect(spy).toHaveBeenCalledWith("tvl_drain", "aave", "tvl_usd", 10_000_000);
            expect(spy).toHaveBeenCalledWith("tvl_surge", "aave", "tvl_usd", 10_000_000);
            spy.mockRestore();
        });

        it("includes chain in asset identifier when provided", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processTVL("aave", 10_000_000, "ethereum");
            expect(spy).toHaveBeenCalledWith("tvl_drain", "aave:ethereum", "tvl_usd", 10_000_000);
            spy.mockRestore();
        });
    });

    describe("processStablecoinPrice", () => {
        it("feeds depeg data for prices deviating > 0.1% from $1", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processStablecoinPrice("usdt", 0.995); // 0.5% off
            expect(spy).toHaveBeenCalledWith(
                "stablecoin_depeg",
                "usdt",
                "price_usd",
                0.995,
                expect.objectContaining({ pegDeviation: expect.any(Number) }),
            );
            spy.mockRestore();
        });

        it("skips prices within 0.1% of peg", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processStablecoinPrice("usdt", 1.0005); // 0.05% off
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe("processGas", () => {
        it("feeds gas data into spike detector", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processGas("ethereum", 150);
            expect(spy).toHaveBeenCalledWith("gas_spike", "ethereum", "gas_gwei", 150);
            spy.mockRestore();
        });
    });

    describe("processDerivatives", () => {
        it("feeds funding rate and open interest data", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processDerivatives("BTCUSDT", 0.01, 5_000_000_000);
            expect(spy).toHaveBeenCalledWith("funding_rate_extreme", "BTCUSDT", "funding_rate", 0.01);
            expect(spy).toHaveBeenCalledWith("open_interest_surge", "BTCUSDT", "open_interest", 5_000_000_000);
            spy.mockRestore();
        });
    });

    describe("processExchangeFlow", () => {
        it("feeds inflow data into exchange_inflow detector", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processExchangeFlow("BTC", "binance", 1000, "inflow");
            expect(spy).toHaveBeenCalledWith(
                "exchange_inflow",
                "BTC:binance",
                expect.any(String),
                1000,
            );
            spy.mockRestore();
        });

        it("feeds outflow data into exchange_outflow detector", () => {
            const spy = vi.spyOn(anomalyEngine, "ingest");
            processExchangeFlow("ETH", "coinbase", 5000, "outflow");
            expect(spy).toHaveBeenCalledWith(
                "exchange_outflow",
                "ETH:coinbase",
                expect.any(String),
                5000,
            );
            spy.mockRestore();
        });
    });
});
