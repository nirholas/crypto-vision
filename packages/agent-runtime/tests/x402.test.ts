/**
 * x402 Protocol Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PricingManager } from '../src/protocols/x402/pricing.js';
import { PaymentFacilitator } from '../src/protocols/x402/facilitator.js';
import type { PaymentReceipt } from '../src/protocols/x402/types.js';

describe('PricingManager', () => {
  let manager: PricingManager;

  beforeEach(() => {
    manager = new PricingManager(97); // BSC Testnet
  });

  it('should add routes from config', () => {
    manager.addFromConfig({
      'trading/execute': { price: '0.001', token: 'USDC' },
      'analysis/report': { price: '0.0005', token: 'USDC' },
    });

    expect(manager.getAllRoutes()).toHaveLength(2);
  });

  it('should check if a route is paywalled', () => {
    manager.addRoute({
      route: 'premium/endpoint',
      price: '0.01',
      token: 'USDC',
    });

    expect(manager.isPaywalled('premium/endpoint')).toBe(true);
    expect(manager.isPaywalled('free/endpoint')).toBe(false);
  });

  it('should get route pricing', () => {
    manager.addRoute({
      route: 'test/route',
      price: '0.005',
      token: 'USDC',
    });

    const pricing = manager.getRoutePrice('test/route');
    expect(pricing).toBeDefined();
    expect(pricing!.price).toBe('0.005');
    expect(pricing!.token).toBe('USDC');
  });

  it('should remove routes', () => {
    manager.addRoute({
      route: 'removable',
      price: '0.001',
      token: 'USDC',
    });

    expect(manager.isPaywalled('removable')).toBe(true);
    manager.removeRoute('removable');
    expect(manager.isPaywalled('removable')).toBe(false);
  });

  it('should convert amounts to smallest unit', () => {
    const result = manager.toSmallestUnit('1.5', 18);
    expect(result).toBe('1500000000000000000');
  });

  it('should convert amounts to human readable', () => {
    const result = manager.toHumanReadable('1500000000000000000', 18);
    expect(result).toBe('1.5');
  });

  it('should normalize routes (case insensitive, strip slashes)', () => {
    manager.addRoute({
      route: '/Trading/Execute/',
      price: '0.001',
      token: 'USDC',
    });

    expect(manager.isPaywalled('trading/execute')).toBe(true);
    expect(manager.isPaywalled('Trading/Execute')).toBe(true);
  });
});

describe('PaymentFacilitator', () => {
  let facilitator: PaymentFacilitator;

  beforeEach(() => {
    facilitator = new PaymentFacilitator({
      chainId: 97,
      payeeAddress: '0x1234567890abcdef1234567890abcdef12345678',
      tokens: [
        { symbol: 'USDC', address: '0x64544969ed7EBf5f083679233325356EbE738930', decimals: 18, chainId: 97 },
      ],
    });
  });

  it('should record receipts', () => {
    const receipt: PaymentReceipt = {
      paymentId: 'pay-1',
      payer: '0xaaa',
      payee: '0xbbb',
      amount: '1000000',
      token: 'USDC',
      chainId: 97,
      txHash: '0x' + 'cc'.repeat(32),
      timestamp: Date.now(),
      route: 'trading/execute',
    };

    facilitator.recordReceipt(receipt);
    expect(facilitator.getReceipt('pay-1')).toEqual(receipt);
  });

  it('should get receipts by route', () => {
    facilitator.recordReceipt({
      paymentId: 'pay-1',
      payer: '0xaaa',
      payee: '0xbbb',
      amount: '1000',
      token: 'USDC',
      chainId: 97,
      txHash: '0x' + 'aa'.repeat(32),
      timestamp: Date.now(),
      route: 'trading/execute',
    });

    facilitator.recordReceipt({
      paymentId: 'pay-2',
      payer: '0xccc',
      payee: '0xbbb',
      amount: '2000',
      token: 'USDC',
      chainId: 97,
      txHash: '0x' + 'bb'.repeat(32),
      timestamp: Date.now(),
      route: 'analysis/report',
    });

    const tradingReceipts = facilitator.getReceiptsForRoute('trading/execute');
    expect(tradingReceipts).toHaveLength(1);
  });

  it('should calculate route revenue', () => {
    facilitator.recordReceipt({
      paymentId: 'pay-1',
      payer: '0xaaa',
      payee: '0xbbb',
      amount: '1000',
      token: 'USDC',
      chainId: 97,
      txHash: '0x' + 'aa'.repeat(32),
      timestamp: Date.now(),
      route: 'trading/execute',
    });

    facilitator.recordReceipt({
      paymentId: 'pay-2',
      payer: '0xccc',
      payee: '0xbbb',
      amount: '2000',
      token: 'USDC',
      chainId: 97,
      txHash: '0x' + 'bb'.repeat(32),
      timestamp: Date.now(),
      route: 'trading/execute',
    });

    expect(facilitator.getRouteRevenue('trading/execute')).toBe(3000n);
    expect(facilitator.getTotalRevenue()).toBe(3000n);
  });

  it('should find tokens by symbol', () => {
    const token = facilitator.findToken('USDC');
    expect(token).toBeDefined();
    expect(token!.decimals).toBe(18);
  });

  it('should return payee address', () => {
    expect(facilitator.payeeAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });
});
