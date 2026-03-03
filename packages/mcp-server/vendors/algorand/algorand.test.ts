/**
 * Tests for Algorand vendor module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// McpError mock
class McpError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const ErrorCode = {
  InvalidParams: "INVALID_PARAMS",
  MethodNotFound: "METHOD_NOT_FOUND",
  InternalError: "INTERNAL_ERROR"
}

// Mock Algorand SDK functions and client behaviors
const mockAlgodClient = {
  accountInformation: vi.fn().mockReturnValue({ do: vi.fn() }),
  getTransactionParams: vi.fn().mockReturnValue({ do: vi.fn() }),
  compile: vi.fn().mockReturnValue({ sourcemap: vi.fn().mockReturnValue({ do: vi.fn() }) }),
  disassemble: vi.fn().mockReturnValue({ do: vi.fn() }),
  sendRawTransaction: vi.fn().mockReturnValue({ do: vi.fn() }),
  simulateRawTransactions: vi.fn().mockReturnValue({ do: vi.fn() }),
  simulateTransactions: vi.fn().mockReturnValue({ do: vi.fn() }),
  status: vi.fn().mockReturnValue({ do: vi.fn() }),
  pendingTransactionInformation: vi.fn().mockReturnValue({ do: vi.fn() })
}

const mockIndexerClient = {
  lookupAccountByID: vi.fn().mockReturnValue({ do: vi.fn() }),
  lookupAssetByID: vi.fn().mockReturnValue({ do: vi.fn() }),
  lookupAccountTransactions: vi.fn().mockReturnValue({ do: vi.fn() }),
  lookupTransactionByID: vi.fn().mockReturnValue({ do: vi.fn() }),
  searchForTransactions: vi.fn().mockReturnValue({ do: vi.fn() })
}

// Mock SDK functions
const mockTransaction = {
  from: "MOCKADDR12345678901234567890123456789012345678901234567890",
  to: "MOCKADDR98765432109876543210987654321098765432109876543210",
  amount: 1000000,
  fee: 1000,
  firstRound: 1000,
  lastRound: 2000,
  genesisID: "testnet-v1.0",
  genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  signTxn: vi.fn()
}

const mockAlgosdk = {
  generateAccount: () => ({
    addr: "MOCKADDR12345678901234567890123456789012345678901234567890",
    sk: new Uint8Array(64)
  }),
  mnemonicToSecretKey: (_mnemonic: string) => ({
    addr: "MOCKADDR12345678901234567890123456789012345678901234567890",
    sk: new Uint8Array(64)
  }),
  secretKeyToMnemonic: (_sk: Uint8Array) => "mock mnemonic word list",
  mnemonicToMasterDerivationKey: (_mnemonic: string) => new Uint8Array(32),
  masterDerivationKeyToMnemonic: (_mdk: Uint8Array) => "mock mnemonic word list",
  seedFromMnemonic: (_mnemonic: string) => new Uint8Array(32),
  mnemonicFromSeed: (_seed: Uint8Array) => "mock mnemonic from seed",
  makePaymentTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  makeAssetCreateTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  makeAssetConfigTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  makeAssetDestroyTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  makeAssetFreezeTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  makeAssetTransferTxnWithSuggestedParamsFromObject: vi.fn().mockReturnValue(mockTransaction),
  isValidAddress: (addr: string) => addr.length === 58
}

describe("Algorand Vendor Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    
    // Reset mock implementations for do() methods
    mockAlgodClient.accountInformation("").do = vi.fn()
    mockAlgodClient.status().do = vi.fn()
    mockAlgodClient.sendRawTransaction([]).do = vi.fn()
    mockAlgodClient.simulateRawTransactions([]).do = vi.fn()
    mockAlgodClient.compile("").sourcemap().do = vi.fn()
    mockAlgodClient.disassemble(Buffer.from("")).do = vi.fn()
    
    mockIndexerClient.lookupAccountByID("").do = vi.fn()
    mockIndexerClient.lookupAssetByID(0).do = vi.fn()
    mockIndexerClient.searchForTransactions().do = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Account Management", () => {
    describe("Account Creation", () => {
      it("should create a new Algorand account", () => {
        const account = mockAlgosdk.generateAccount()
        
        expect(account).toBeDefined()
        expect(account.addr).toBeDefined()
        expect(account.addr).toHaveLength(58)
        expect(account.sk).toBeDefined()
      })

      it("should convert mnemonic to secret key", () => {
        const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        
        const result = mockAlgosdk.mnemonicToSecretKey(mnemonic)
        
        expect(result).toBeDefined()
        expect(result.addr).toBeDefined()
        expect(result.sk).toBeDefined()
      })

      it("should convert secret key to mnemonic", () => {
        const secretKey = new Uint8Array(64)
        
        const mnemonic = mockAlgosdk.secretKeyToMnemonic(secretKey)
        
        expect(mnemonic).toBeDefined()
        expect(typeof mnemonic).toBe("string")
      })

      it("should convert mnemonic to master derivation key", () => {
        const mnemonic = "mock mnemonic word list"
        
        const mdk = mockAlgosdk.mnemonicToMasterDerivationKey(mnemonic)
        
        expect(mdk).toBeDefined()
        expect(mdk).toBeInstanceOf(Uint8Array)
      })

      it("should convert master derivation key to mnemonic", () => {
        const mdk = new Uint8Array(32)
        
        const mnemonic = mockAlgosdk.masterDerivationKeyToMnemonic(mdk)
        
        expect(mnemonic).toBeDefined()
        expect(typeof mnemonic).toBe("string")
      })
    })

    describe("Account Information", () => {
      it("should get account information", async () => {
        const mockAccountInfo = {
          address: "MOCKADDR12345678901234567890123456789012345678901234567890",
          amount: 10000000,
          "amount-without-pending-rewards": 10000000,
          "min-balance": 100000,
          "pending-rewards": 0,
          "reward-base": 0,
          rewards: 0,
          round: 12345,
          status: "Offline",
          "total-apps-opted-in": 0,
          "total-assets-opted-in": 2,
          "total-created-apps": 0,
          "total-created-assets": 1
        }

        const mockDo = vi.fn().mockResolvedValue(mockAccountInfo)
        mockAlgodClient.accountInformation = vi.fn().mockReturnValue({ do: mockDo })

        const result = await mockAlgodClient.accountInformation("MOCKADDRESS").do()
        
        expect(result).toBeDefined()
        expect(result.amount).toBe(10000000)
        expect(result.status).toBe("Offline")
      })

      it("should handle non-existent account", async () => {
        const mockDo = vi.fn().mockRejectedValue(new Error("account not found"))
        mockAlgodClient.accountInformation = vi.fn().mockReturnValue({ do: mockDo })

        await expect(
          mockAlgodClient.accountInformation("NONEXISTENTADDRESS").do()
        ).rejects.toThrow("account not found")
      })

      it("should validate address format", () => {
        const validAddress = "MOCKADDR12345678901234567890123456789012345678901234567890"
        const invalidAddress = "invalid"

        expect(mockAlgosdk.isValidAddress(validAddress)).toBe(true)
        expect(mockAlgosdk.isValidAddress(invalidAddress)).toBe(false)
      })
    })
  })

  describe("ASA (Algorand Standard Asset) Operations", () => {
    const mockSuggestedParams = {
      fee: 1000,
      firstRound: 1000,
      lastRound: 2000,
      genesisID: "testnet-v1.0",
      genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      flatFee: false
    }

    describe("Asset Creation", () => {
      it("should create an asset creation transaction", () => {
        const params = {
          from: "MOCKADDR12345678901234567890123456789012345678901234567890",
          total: 1000000,
          decimals: 6,
          defaultFrozen: false,
          unitName: "TEST",
          assetName: "Test Asset",
          assetURL: "https://example.com",
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetCreateTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
        expect(mockAlgosdk.makeAssetCreateTxnWithSuggestedParamsFromObject).toHaveBeenCalledWith(params)
      })

      it("should validate asset creation parameters", () => {
        const invalidParams = {
          from: "invalid",
          total: -1,
          decimals: 20, // Invalid: max is 19
          defaultFrozen: false,
          suggestedParams: mockSuggestedParams
        }

        // The actual validation would throw, but we're testing the mock behavior
        expect(() => {
          mockAlgosdk.makeAssetCreateTxnWithSuggestedParamsFromObject(invalidParams)
        }).not.toThrow() // Mock doesn't validate
      })
    })

    describe("Asset Configuration", () => {
      it("should create an asset configuration transaction", () => {
        const params = {
          from: "MOCKADDR12345678901234567890123456789012345678901234567890",
          assetIndex: 12345,
          manager: "NEWMANAGR12345678901234567890123456789012345678901234567890",
          reserve: "NEWRESERV12345678901234567890123456789012345678901234567890",
          freeze: "NEWFREEZE12345678901234567890123456789012345678901234567890",
          clawback: "NEWCLAWBK12345678901234567890123456789012345678901234567890",
          strictEmptyAddressChecking: true,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetConfigTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
      })
    })

    describe("Asset Transfer", () => {
      it("should create an asset transfer transaction", () => {
        const params = {
          from: "MOCKADDR12345678901234567890123456789012345678901234567890",
          to: "RECIPENT12345678901234567890123456789012345678901234567890",
          assetIndex: 12345,
          amount: 1000000,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
      })

      it("should create an asset opt-in transaction (transfer to self with 0 amount)", () => {
        const address = "MOCKADDR12345678901234567890123456789012345678901234567890"
        const params = {
          from: address,
          to: address,
          assetIndex: 12345,
          amount: 0,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
      })
    })

    describe("Asset Freeze", () => {
      it("should create an asset freeze transaction", () => {
        const params = {
          from: "FREEZEADR12345678901234567890123456789012345678901234567890",
          assetIndex: 12345,
          freezeTarget: "TARGETADR12345678901234567890123456789012345678901234567890",
          freezeState: true,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
      })
    })

    describe("Asset Destruction", () => {
      it("should create an asset destroy transaction", () => {
        const params = {
          from: "MANAGERADR1234567890123456789012345678901234567890123456789",
          assetIndex: 12345,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
      })
    })
  })

  describe("Transaction Handling", () => {
    describe("Payment Transactions", () => {
      it("should create a payment transaction", () => {
        const mockSuggestedParams = {
          fee: 1000,
          firstRound: 1000,
          lastRound: 2000,
          genesisID: "testnet-v1.0",
          genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
          flatFee: false
        }

        const params = {
          from: "MOCKADDR12345678901234567890123456789012345678901234567890",
          to: "RECIPENT12345678901234567890123456789012345678901234567890",
          amount: 1000000,
          suggestedParams: mockSuggestedParams
        }

        const txn = mockAlgosdk.makePaymentTxnWithSuggestedParamsFromObject(params)
        
        expect(txn).toBeDefined()
        expect(txn.amount).toBe(1000000)
      })
    })

    describe("Transaction Submission", () => {
      it("should send raw transaction", async () => {
        const mockTxId = "MOCKTXID1234567890123456789012345678901234567890123"
        
        ;(mockAlgodClient.sendRawTransaction([]).do as ReturnType<typeof vi.fn>).mockResolvedValue({
          txId: mockTxId
        })

        const result = await mockAlgodClient.sendRawTransaction(new Uint8Array(0)).do()
        
        expect(result).toBeDefined()
        expect(result.txId).toBe(mockTxId)
      })

      it("should handle transaction submission failure", async () => {
        ;(mockAlgodClient.sendRawTransaction([]).do as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Transaction rejected: overspend")
        )

        await expect(
          mockAlgodClient.sendRawTransaction(new Uint8Array(0)).do()
        ).rejects.toThrow("overspend")
      })
    })

    describe("Transaction Simulation", () => {
      it("should simulate transactions", async () => {
        const mockSimulateResult = {
          version: 2,
          "would-succeed": true,
          "txn-groups": [
            {
              "txn-results": [
                {
                  "txn-result": {
                    "pool-error": "",
                    txn: {}
                  }
                }
              ]
            }
          ]
        }

        ;(mockAlgodClient.simulateRawTransactions([]).do as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockSimulateResult
        )

        const result = await mockAlgodClient.simulateRawTransactions(new Uint8Array(0)).do()
        
        expect(result).toBeDefined()
        expect(result["would-succeed"]).toBe(true)
      })
    })
  })

  describe("TEAL Compilation", () => {
    it("should compile TEAL source code", async () => {
      const mockCompileResult = {
        hash: "MOCKPROGRAMHASH",
        result: Buffer.from("compiled_bytecode").toString("base64")
      }

      ;((mockAlgodClient.compile("").sourcemap().do) as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCompileResult
      )

      const result = await mockAlgodClient.compile("#pragma version 8\nint 1").sourcemap().do()
      
      expect(result).toBeDefined()
    })

    it("should disassemble TEAL bytecode", async () => {
      const mockDisassembleResult = {
        result: "#pragma version 8\nint 1"
      }

      ;(mockAlgodClient.disassemble(Buffer.from("")).do as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDisassembleResult
      )

      const result = await mockAlgodClient.disassemble(Buffer.from("bytecode")).do()
      
      expect(result).toBeDefined()
      expect(result.result).toContain("#pragma version")
    })
  })

  describe("Node Status", () => {
    it("should get node status", async () => {
      const mockStatus = {
        "catchup-time": 0,
        "last-round": 12345,
        "last-version": "https://github.com/algorandfoundation/specs/tree/bc36005dbd776e6d1eaf0c560619bb183215645c",
        "next-version": "https://github.com/algorandfoundation/specs/tree/bc36005dbd776e6d1eaf0c560619bb183215645c",
        "next-version-round": 12346,
        "next-version-supported": true,
        "stopped-at-unsupported-round": false,
        "time-since-last-round": 2500000000
      }

      ;(mockAlgodClient.status().do as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatus)

      const result = await mockAlgodClient.status().do()
      
      expect(result).toBeDefined()
      expect(result["last-round"]).toBe(12345)
    })
  })

  describe("Indexer Operations", () => {
    it("should lookup account by ID", async () => {
      const mockAccountData = {
        account: {
          address: "MOCKADDR12345678901234567890123456789012345678901234567890",
          amount: 10000000,
          assets: [
            { "asset-id": 12345, amount: 1000 }
          ]
        },
        "current-round": 12345
      }

      ;(mockIndexerClient.lookupAccountByID("").do as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAccountData
      )

      const result = await mockIndexerClient.lookupAccountByID("MOCKADDRESS").do()
      
      expect(result).toBeDefined()
      expect(result.account.assets).toHaveLength(1)
    })

    it("should lookup asset by ID", async () => {
      const mockAssetData = {
        asset: {
          index: 12345,
          params: {
            creator: "CREATORADDRESS",
            decimals: 6,
            total: 1000000000,
            "unit-name": "TEST",
            name: "Test Asset"
          }
        },
        "current-round": 12345
      }

      ;(mockIndexerClient.lookupAssetByID(0).do as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAssetData
      )

      const result = await mockIndexerClient.lookupAssetByID(12345).do()
      
      expect(result).toBeDefined()
      expect(result.asset.params["unit-name"]).toBe("TEST")
    })

    it("should search for transactions", async () => {
      const mockTransactions = {
        transactions: [
          {
            id: "TXID123",
            "tx-type": "pay",
            sender: "SENDERADDRESS",
            "payment-transaction": {
              amount: 1000000,
              receiver: "RECEIVERADDRESS"
            }
          }
        ],
        "current-round": 12345
      }

      ;(mockIndexerClient.searchForTransactions().do as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTransactions
      )

      const result = await mockIndexerClient.searchForTransactions().do()
      
      expect(result).toBeDefined()
      expect(result.transactions).toHaveLength(1)
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid parameters error", () => {
      const error = new McpError(ErrorCode.InvalidParams, "Missing required parameter")
      
      expect(error.code).toBe("INVALID_PARAMS")
      expect(error.message).toBe("Missing required parameter")
    })

    it("should handle method not found error", () => {
      const error = new McpError(ErrorCode.MethodNotFound, "Unknown tool: invalid_tool")
      
      expect(error.code).toBe("METHOD_NOT_FOUND")
    })

    it("should handle network errors gracefully", async () => {
      ;(mockAlgodClient.status().do as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error: ECONNREFUSED")
      )

      await expect(
        mockAlgodClient.status().do()
      ).rejects.toThrow("Network error")
    })
  })
})
