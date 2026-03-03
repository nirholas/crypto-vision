/**
 * ERC-8004 Protocol Tests
 */

import { describe, it, expect } from 'vitest';
import { resolveChain, getSupportedChains, CHAINS } from '../src/utils/chains.js';
import { encodeAsDataURI, decodeOnChainURI, IDENTITY_ABI, REPUTATION_ABI } from '../src/utils/contracts.js';
import { privateKeyToAddress, generateNonce, keccak256, signMessage, verifyMessage } from '../src/utils/crypto.js';

describe('Chain Configuration', () => {
  it('should resolve chain by key', () => {
    const chain = resolveChain('bsc-testnet');
    expect(chain.chainId).toBe(97);
    expect(chain.name).toBe('BSC Testnet');
    expect(chain.testnet).toBe(true);
  });

  it('should resolve chain by ID', () => {
    const chain = resolveChain(56);
    expect(chain.name).toBe('BSC Mainnet');
  });

  it('should resolve chain by string ID', () => {
    const chain = resolveChain('97');
    expect(chain.chainId).toBe(97);
  });

  it('should throw for unknown chain', () => {
    expect(() => resolveChain('unknown-chain')).toThrow();
  });

  it('should list all supported chains', () => {
    const chains = getSupportedChains();
    expect(chains).toContain('bsc-testnet');
    expect(chains).toContain('bsc-mainnet');
    expect(chains).toContain('ethereum');
    expect(chains).toContain('sepolia');
    expect(chains.length).toBeGreaterThan(5);
  });

  it('should have correct contract addresses', () => {
    const bscTestnet = CHAINS['bsc-testnet'];
    expect(bscTestnet.contracts.identity).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(bscTestnet.contracts.reputation).toBe('0x8004B663056A597Dffe9eCcC1965A193B7388713');
    expect(bscTestnet.contracts.validation).toBe('0x8004Cb1BF31DAf7788923b405b754f57acEB4272');
  });

  it('should have mainnet contracts', () => {
    const bscMainnet = CHAINS['bsc-mainnet'];
    expect(bscMainnet.contracts.identity).toBe('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
    expect(bscMainnet.contracts.reputation).toBe('0x8004BAa17C55a88189AE136b182e5fdA19dE9b63');
  });

  it('should have CAIP-10 agent registry', () => {
    const chain = resolveChain('bsc-testnet');
    expect(chain.agentRegistry).toMatch(/^eip155:97:0x/);
  });
});

describe('Contract ABIs', () => {
  it('should have identity registry ABI', () => {
    expect(IDENTITY_ABI).toBeDefined();
    expect(IDENTITY_ABI.length).toBeGreaterThan(5);
    expect(IDENTITY_ABI.some((a) => a.includes('register'))).toBe(true);
  });

  it('should have reputation registry ABI', () => {
    expect(REPUTATION_ABI).toBeDefined();
    expect(REPUTATION_ABI.some((a) => a.includes('submitFeedback'))).toBe(true);
  });
});

describe('Data URI Encoding', () => {
  it('should encode and decode registration JSON', () => {
    const data = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'Test Agent',
      description: 'A test agent',
      active: true,
    };

    const uri = encodeAsDataURI(data);
    expect(uri).toMatch(/^data:application\/json;base64,/);

    const decoded = decodeOnChainURI(uri);
    expect(decoded).toBeDefined();
    expect((decoded as any).name).toBe('Test Agent');
    expect((decoded as any).active).toBe(true);
  });

  it('should handle plain JSON strings', () => {
    const json = '{"name": "Test"}';
    const decoded = decodeOnChainURI(json);
    expect(decoded).toEqual({ name: 'Test' });
  });

  it('should return null for invalid input', () => {
    const decoded = decodeOnChainURI('not-valid');
    expect(decoded).toBeNull();
  });
});

describe('Crypto Utilities', () => {
  const TEST_KEY = '0x' + 'ab'.repeat(32);

  it('should derive address from private key', () => {
    const address = privateKeyToAddress(TEST_KEY);
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('should generate unique nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
    expect(nonce1).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('should hash data using keccak256', () => {
    const hash = keccak256('hello');
    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('should produce consistent hashes', () => {
    const hash1 = keccak256('hello');
    const hash2 = keccak256('hello');
    expect(hash1).toBe(hash2);
  });

  it('should sign and verify messages', async () => {
    const message = 'Hello, ERC-8004!';
    const signature = await signMessage(TEST_KEY, message);

    expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);

    const recovered = verifyMessage(message, signature);
    const address = privateKeyToAddress(TEST_KEY);
    expect(recovered.toLowerCase()).toBe(address.toLowerCase());
  });
});
