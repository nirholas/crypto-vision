/**
 * Tests for Solana Wallet Scanner
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SolanaScanner, ExtendedSolanaScanner } from "../../../src/services/wallet/chains/solana.js";

// Mock environment
vi.stubEnv("HELIUS_API_KEY", "test-helius-key");

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock price service
vi.mock("../../../src/services/price.service.js", () => ({
  getValidatedPrice: vi.fn().mockResolvedValue({ price: 150, confidence: 0.9 }),
}));

describe("SolanaScanner", () => {
  let scanner: SolanaScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new SolanaScanner();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("scan", () => {
    it("should scan wallet and return balances", async () => {
      // Mock getAssetsByOwner response
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getAssetsByOwner") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                items: [
                  {
                    id: "Token1111111111111111111111111111111111111",
                    interface: "FungibleToken",
                    content: {
                      metadata: {
                        name: "Test Token",
                        symbol: "TEST",
                      },
                      links: {
                        image: "https://example.com/token.png",
                      },
                    },
                    token_info: {
                      balance: 1000000000,
                      decimals: 9,
                      price_info: {
                        price_per_token: 0.5,
                        total_price: 0.5,
                      },
                    },
                  },
                ],
                total: 1,
                limit: 1000,
                page: 1,
              },
            }),
          });
        }

        if (body.method === "getBalance") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                value: 5000000000, // 5 SOL
              },
            }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      const result = await scanner.scan("WalletAddress1111111111111111111111111111");

      expect(result.chain).toBe("solana");
      expect(result.address).toBe("WalletAddress1111111111111111111111111111");
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].symbol).toBe("TEST");
      expect(result.nativeBalance).toBe("5000000000");
    });

    it("should paginate through all assets", async () => {
      let pageCount = 0;
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getAssetsByOwner") {
          pageCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                items: pageCount === 1 
                  ? Array(1000).fill({
                      id: `Token${pageCount}`,
                      interface: "FungibleToken",
                      content: { metadata: { name: "Token", symbol: "TKN" } },
                      token_info: { balance: 1000000, decimals: 6 },
                    })
                  : [],
                total: 1000,
                limit: 1000,
                page: body.params.page,
              },
            }),
          });
        }

        if (body.method === "getBalance") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: { value: 1000000000 } }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      await scanner.scan("WalletAddress1111111111111111111111111111");

      // Should have made at least 2 page requests
      expect(pageCount).toBeGreaterThanOrEqual(2);
    });

    it("should filter out NFTs", async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getAssetsByOwner") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                items: [
                  {
                    id: "NFT1111111111111111111111111111111111111111",
                    interface: "V1_NFT", // This should be filtered out
                    content: { metadata: { name: "NFT", symbol: "NFT" } },
                  },
                  {
                    id: "Token1111111111111111111111111111111111111",
                    interface: "FungibleToken",
                    content: { metadata: { name: "Token", symbol: "TKN" } },
                    token_info: { balance: 1000000, decimals: 6 },
                  },
                ],
                total: 2,
                limit: 1000,
                page: 1,
              },
            }),
          });
        }

        if (body.method === "getBalance") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: { value: 1000000000 } }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      const result = await scanner.scan("WalletAddress1111111111111111111111111111");

      // Should only have the fungible token
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].symbol).toBe("TKN");
    });
  });
});

describe("ExtendedSolanaScanner", () => {
  let scanner: ExtendedSolanaScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new ExtendedSolanaScanner();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchAllTokenAccounts", () => {
    it("should fetch token accounts from both programs", async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getTokenAccountsByOwner") {
          const programId = body.params[1].programId;
          const isToken2022 = programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
          
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                value: [
                  {
                    pubkey: isToken2022 ? "Account2022" : "AccountStandard",
                    account: {
                      data: {
                        parsed: {
                          info: {
                            mint: isToken2022 ? "Mint2022" : "MintStandard",
                            owner: "WalletOwner",
                            tokenAmount: {
                              amount: isToken2022 ? "0" : "1000000",
                              decimals: 9,
                              uiAmount: isToken2022 ? 0 : 0.001,
                            },
                          },
                          type: "account",
                        },
                        program: "spl-token",
                      },
                      lamports: 2039280,
                    },
                  },
                ],
              },
            }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      const result = await scanner.fetchAllTokenAccounts("WalletOwner");

      expect(result.accounts).toHaveLength(2);
      expect(result.vacantAccounts).toHaveLength(1);
      expect(result.vacantAccounts[0].isToken2022).toBe(true);
    });

    it("should identify vacant accounts correctly", async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getTokenAccountsByOwner") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                value: [
                  {
                    pubkey: "AccountWithBalance",
                    account: {
                      data: {
                        parsed: {
                          info: {
                            mint: "Mint1",
                            owner: "Owner",
                            tokenAmount: { amount: "1000000", decimals: 6, uiAmount: 1 },
                          },
                        },
                      },
                      lamports: 2039280,
                    },
                  },
                  {
                    pubkey: "VacantAccount",
                    account: {
                      data: {
                        parsed: {
                          info: {
                            mint: "Mint2",
                            owner: "Owner",
                            tokenAmount: { amount: "0", decimals: 6, uiAmount: 0 },
                          },
                        },
                      },
                      lamports: 2039280,
                    },
                  },
                ],
              },
            }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      const result = await scanner.fetchAllTokenAccounts("Owner");

      expect(result.accounts).toHaveLength(2);
      expect(result.vacantAccounts).toHaveLength(1);
      expect(result.vacantAccounts[0].address).toBe("VacantAccount");
    });
  });

  describe("calculateRecoverableRent", () => {
    it("should calculate total recoverable rent", () => {
      const vacantAccounts = [
        { address: "1", mint: "m1", owner: "o", rentLamports: 2039280n, isToken2022: false, programId: "p" },
        { address: "2", mint: "m2", owner: "o", rentLamports: 2039280n, isToken2022: false, programId: "p" },
        { address: "3", mint: "m3", owner: "o", rentLamports: 2039280n, isToken2022: true, programId: "p2" },
      ];

      const total = scanner.calculateRecoverableRent(vacantAccounts);

      expect(total).toBe(6117840n);
    });

    it("should return 0 for empty array", () => {
      const total = scanner.calculateRecoverableRent([]);
      expect(total).toBe(0n);
    });
  });

  describe("scanExtended", () => {
    it("should include vacant accounts in extended scan", async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        const body = JSON.parse(options.body);
        
        if (body.method === "getAssetsByOwner") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                items: [],
                total: 0,
                limit: 1000,
                page: 1,
              },
            }),
          });
        }

        if (body.method === "getBalance") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: { value: 1000000000 } }),
          });
        }

        if (body.method === "getTokenAccountsByOwner") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: {
                value: [
                  {
                    pubkey: "VacantAccount1",
                    account: {
                      data: {
                        parsed: {
                          info: {
                            mint: "Mint1",
                            owner: "Wallet",
                            tokenAmount: { amount: "0", decimals: 6, uiAmount: 0 },
                          },
                        },
                      },
                      lamports: 2039280,
                    },
                  },
                ],
              },
            }),
          });
        }

        return Promise.resolve({ ok: false });
      });

      const result = await scanner.scanExtended("WalletAddress");

      expect(result.vacantAccounts).toBeDefined();
      expect(result.totalRecoverableRent).toBeGreaterThan(0n);
      expect(result.tokenAccounts).toBeDefined();
    });
  });
});
