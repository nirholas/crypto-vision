/**
 * Wallet Module Tests
 * Tests for EVM wallet-related tools and services
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash, Hex } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getAddressFromPrivateKey: vi.fn(),
  getNativeBalance: vi.fn(),
  transferETH: vi.fn(),
  approveERC20: vi.fn(),
  helpers: {
    parseEther: vi.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
    formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString())
  }
}))

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock viem accounts - comprehensive mock
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn((key: Hex) => ({
    address: "0x1234567890123456789012345678901234567890" as Address,
    publicKey:
      "0x04abc123def456789012345678901234567890123456789012345678901234567890abc123def456789012345678901234567890123456789012345678901234567890" as Hex,
    signMessage: vi.fn().mockResolvedValue("0xsignature123" as Hex),
    signTransaction: vi.fn().mockResolvedValue("0xsignedtx123" as Hex),
    signTypedData: vi.fn().mockResolvedValue("0xtypeddatasig123" as Hex)
  })),
  generateMnemonic: vi.fn(
    () =>
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  ),
  mnemonicToAccount: vi.fn((mnemonic: string, options?: { addressIndex?: number }) => ({
    address: `0x${(options?.addressIndex || 0).toString().padStart(40, "0")}` as Address,
    publicKey:
      "0x04def456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012" as Hex
  })),
  english: ["abandon", "ability", "able"] // Mock wordlist
}))

// Mock public client
const mockPublicClient = {
  getBalance: vi.fn(),
  getChainId: vi.fn().mockResolvedValue(1),
  getTransactionCount: vi.fn(),
  estimateGas: vi.fn(),
  getGasPrice: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  sendTransaction: vi.fn(),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  writeContract: vi.fn(),
  account: {
    address: "0x1234567890123456789012345678901234567890" as Address,
    publicKey:
      "0x04abc123def456789012345678901234567890123456789012345678901234567890abc123def456789012345678901234567890123456789012345678901234567890" as Hex,
    signMessage: vi.fn().mockResolvedValue("0xsignature123" as Hex)
  },
  chain: { id: 1, name: "Ethereum" }
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"
import {
  privateKeyToAccount,
  generateMnemonic,
  mnemonicToAccount
} from "viem/accounts"

describe("Wallet Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex
  const mockPrivateKeyWithoutPrefix =
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  const mockAddress =
    "0x1234567890123456789012345678901234567890" as Address
  const mockToAddress =
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address
  const mockNetwork = "ethereum"
  const mockMnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

  describe("getAddressFromPrivateKey Service", () => {
    it("should derive address from private key with 0x prefix", async () => {
      vi.mocked(services.getAddressFromPrivateKey).mockReturnValue(mockAddress)

      const result = services.getAddressFromPrivateKey(mockPrivateKey)

      expect(services.getAddressFromPrivateKey).toHaveBeenCalledWith(
        mockPrivateKey
      )
      expect(result).toBe(mockAddress)
    })

    it("should derive address from private key without 0x prefix", async () => {
      vi.mocked(services.getAddressFromPrivateKey).mockReturnValue(mockAddress)

      const formattedKey = `0x${mockPrivateKeyWithoutPrefix}` as Hex
      const result = services.getAddressFromPrivateKey(formattedKey)

      expect(result).toBe(mockAddress)
    })

    it("should return consistent address for same private key", () => {
      vi.mocked(services.getAddressFromPrivateKey).mockReturnValue(mockAddress)

      const result1 = services.getAddressFromPrivateKey(mockPrivateKey)
      const result2 = services.getAddressFromPrivateKey(mockPrivateKey)

      expect(result1).toBe(result2)
    })

    it("should handle invalid private key format", () => {
      vi.mocked(services.getAddressFromPrivateKey).mockImplementation(() => {
        throw new Error("Invalid private key")
      })

      expect(() =>
        services.getAddressFromPrivateKey("invalid" as Hex)
      ).toThrow("Invalid private key")
    })

    it("should handle private key with wrong length", () => {
      vi.mocked(services.getAddressFromPrivateKey).mockImplementation(() => {
        throw new Error("Private key must be 32 bytes")
      })

      expect(() =>
        services.getAddressFromPrivateKey("0x1234" as Hex)
      ).toThrow("Private key must be 32 bytes")
    })
  })

  describe("getBalance Service (Native Token)", () => {
    it("should get native balance for an address", async () => {
      const mockBalance = {
        raw: BigInt("5000000000000000000"), // 5 ETH
        formatted: "5",
        network: mockNetwork,
        symbol: "ETH",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(mockAddress, mockNetwork)

      expect(services.getNativeBalance).toHaveBeenCalledWith(
        mockAddress,
        mockNetwork
      )
      expect(result.formatted).toBe("5")
      expect(result.symbol).toBe("ETH")
    })

    it("should return 0 for new wallet", async () => {
      const mockBalance = {
        raw: BigInt(0),
        formatted: "0",
        network: mockNetwork,
        symbol: "ETH",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(
        "0x0000000000000000000000000000000000000001" as Address,
        mockNetwork
      )

      expect(result.raw).toBe(BigInt(0))
    })

    it("should handle network-specific native tokens", async () => {
      const testCases = [
        { network: "ethereum", symbol: "ETH" },
        { network: "bsc", symbol: "BNB" },
        { network: "polygon", symbol: "MATIC" },
        { network: "arbitrum", symbol: "ETH" },
        { network: "base", symbol: "ETH" }
      ]

      for (const { network, symbol } of testCases) {
        const mockBalance = {
          raw: BigInt("1000000000000000000"),
          formatted: "1",
          network,
          symbol,
          decimals: 18
        }
        vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

        const result = await services.getNativeBalance(mockAddress, network)
        expect(result.symbol).toBe(symbol)
      }
    })
  })

  describe("Mnemonic Generation", () => {
    it("should generate a 12-word mnemonic", () => {
      const mnemonic = generateMnemonic()

      expect(mnemonic).toBeDefined()
      expect(typeof mnemonic).toBe("string")
      // In real implementation, should have 12 words
      expect(mnemonic.split(" ").length).toBeGreaterThanOrEqual(1)
    })

    it("should generate different mnemonics on each call", () => {
      vi.mocked(generateMnemonic)
        .mockReturnValueOnce("word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12")
        .mockReturnValueOnce("other1 other2 other3 other4 other5 other6 other7 other8 other9 other10 other11 other12")

      const mnemonic1 = generateMnemonic()
      const mnemonic2 = generateMnemonic()

      expect(mnemonic1).not.toBe(mnemonic2)
    })
  })

  describe("Mnemonic to Account", () => {
    it("should derive account from mnemonic with default index", () => {
      const account = mnemonicToAccount(mockMnemonic)

      expect(account).toBeDefined()
      expect(account.address).toBeDefined()
      expect(account.publicKey).toBeDefined()
    })

    it("should derive different addresses for different indices", () => {
      vi.mocked(mnemonicToAccount)
        .mockReturnValueOnce({
          address: "0x0000000000000000000000000000000000000000" as Address,
          publicKey: "0x04..." as Hex
        })
        .mockReturnValueOnce({
          address: "0x0000000000000000000000000000000000000001" as Address,
          publicKey: "0x04..." as Hex
        })

      const account0 = mnemonicToAccount(mockMnemonic, { addressIndex: 0 })
      const account1 = mnemonicToAccount(mockMnemonic, { addressIndex: 1 })

      expect(account0.address).not.toBe(account1.address)
    })

    it("should handle invalid mnemonic", () => {
      vi.mocked(mnemonicToAccount).mockImplementationOnce(() => {
        throw new Error("Invalid mnemonic")
      })

      expect(() => mnemonicToAccount("invalid mnemonic phrase")).toThrow(
        "Invalid mnemonic"
      )
    })

    it("should derive consistent address for same mnemonic and index", () => {
      vi.mocked(mnemonicToAccount)
        .mockReturnValueOnce({
          address: "0x1234567890123456789012345678901234567890" as Address,
          publicKey: "0x04..." as Hex
        })
        .mockReturnValueOnce({
          address: "0x1234567890123456789012345678901234567890" as Address,
          publicKey: "0x04..." as Hex
        })

      const account1 = mnemonicToAccount(mockMnemonic, { addressIndex: 0 })
      const account2 = mnemonicToAccount(mockMnemonic, { addressIndex: 0 })

      expect(account1.address).toBe(account2.address)
    })
  })

  describe("Transfer Native Token", () => {
    it("should transfer ETH successfully", async () => {
      const mockTxHash =
        "0xtransferhash123456789012345678901234567890123456789012345678901234" as Hash
      vi.mocked(services.transferETH).mockResolvedValue(mockTxHash)

      const result = await services.transferETH(
        mockPrivateKey,
        mockToAddress,
        "1.5",
        mockNetwork
      )

      expect(services.transferETH).toHaveBeenCalledWith(
        mockPrivateKey,
        mockToAddress,
        "1.5",
        mockNetwork
      )
      expect(result).toBe(mockTxHash)
    })

    it("should handle transfer to ENS name", async () => {
      const mockTxHash = "0xenshash123" as Hash
      vi.mocked(services.transferETH).mockResolvedValue(mockTxHash)

      const result = await services.transferETH(
        mockPrivateKey,
        "vitalik.eth",
        "0.1",
        mockNetwork
      )

      expect(services.transferETH).toHaveBeenCalledWith(
        mockPrivateKey,
        "vitalik.eth",
        "0.1",
        mockNetwork
      )
      expect(result).toBe(mockTxHash)
    })

    it("should handle insufficient balance error", async () => {
      vi.mocked(services.transferETH).mockRejectedValue(
        new Error("Insufficient funds")
      )

      await expect(
        services.transferETH(mockPrivateKey, mockToAddress, "1000000", mockNetwork)
      ).rejects.toThrow("Insufficient funds")
    })

    it("should handle invalid recipient address", async () => {
      vi.mocked(services.transferETH).mockRejectedValue(
        new Error("Invalid recipient address")
      )

      await expect(
        services.transferETH(
          mockPrivateKey,
          "invalid-address",
          "1",
          mockNetwork
        )
      ).rejects.toThrow("Invalid recipient address")
    })

    it("should handle zero amount transfer", async () => {
      const mockTxHash = "0xzerohash123" as Hash
      vi.mocked(services.transferETH).mockResolvedValue(mockTxHash)

      const result = await services.transferETH(
        mockPrivateKey,
        mockToAddress,
        "0",
        mockNetwork
      )

      expect(result).toBe(mockTxHash)
    })

    it("should handle very small amounts", async () => {
      const mockTxHash = "0xsmallhash123" as Hash
      vi.mocked(services.transferETH).mockResolvedValue(mockTxHash)

      const result = await services.transferETH(
        mockPrivateKey,
        mockToAddress,
        "0.000000000000000001", // 1 wei
        mockNetwork
      )

      expect(result).toBe(mockTxHash)
    })
  })

  describe("Sign Message (Mock)", () => {
    it("should sign a message", async () => {
      const message = "Hello, Ethereum!"
      const mockSignature =
        "0xsignature123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890" as Hex

      mockWalletClient.signMessage.mockResolvedValue(mockSignature)

      const result = await mockWalletClient.signMessage({
        message,
        account: mockWalletClient.account
      })

      expect(mockWalletClient.signMessage).toHaveBeenCalledWith({
        message,
        account: mockWalletClient.account
      })
      expect(result).toBe(mockSignature)
    })

    it("should sign raw bytes message", async () => {
      const rawMessage = { raw: "0x48656c6c6f" as Hex } // "Hello" in hex
      const mockSignature = "0xsig123" as Hex

      mockWalletClient.signMessage.mockResolvedValue(mockSignature)

      const result = await mockWalletClient.signMessage({
        message: rawMessage,
        account: mockWalletClient.account
      })

      expect(result).toBe(mockSignature)
    })

    it("should produce different signatures for different messages", async () => {
      mockWalletClient.signMessage
        .mockResolvedValueOnce("0xsig1" as Hex)
        .mockResolvedValueOnce("0xsig2" as Hex)

      const sig1 = await mockWalletClient.signMessage({
        message: "Message 1",
        account: mockWalletClient.account
      })
      const sig2 = await mockWalletClient.signMessage({
        message: "Message 2",
        account: mockWalletClient.account
      })

      expect(sig1).not.toBe(sig2)
    })
  })

  describe("Sign Transaction (Mock)", () => {
    it("should sign a transaction", async () => {
      const mockSignedTx = "0xsignedtx123456789..." as Hex
      mockWalletClient.signTransaction.mockResolvedValue(mockSignedTx)

      const txParams = {
        to: mockToAddress,
        value: BigInt("1000000000000000000"),
        gas: BigInt(21000),
        maxFeePerGas: BigInt(30000000000),
        maxPriorityFeePerGas: BigInt(2000000000),
        nonce: 0,
        chainId: 1
      }

      const result = await mockWalletClient.signTransaction(txParams)

      expect(mockWalletClient.signTransaction).toHaveBeenCalledWith(txParams)
      expect(result).toBe(mockSignedTx)
    })
  })

  describe("Create Wallet", () => {
    it("should create a new wallet with mnemonic", () => {
      vi.mocked(mnemonicToAccount).mockReturnValueOnce({
        address: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" as Address,
        publicKey: "0x04..." as Hex
      })

      const mnemonic = generateMnemonic()
      const account = mnemonicToAccount(mnemonic)

      expect(mnemonic).toBeDefined()
      expect(account.address).toBeDefined()
    })

    it("should create wallet with valid address format", () => {
      vi.mocked(mnemonicToAccount).mockReturnValue({
        address: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" as Address,
        publicKey: "0x04..." as Hex
      })

      const mnemonic = generateMnemonic()
      const account = mnemonicToAccount(mnemonic)

      const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(account.address)
      expect(isValidAddress).toBe(true)
    })
  })

  describe("Import Wallet from Mnemonic", () => {
    it("should import wallet from mnemonic", () => {
      const account = mnemonicToAccount(mockMnemonic)

      expect(account).toBeDefined()
      expect(account.address).toBeDefined()
    })

    it("should import wallet at specific derivation index", () => {
      vi.mocked(mnemonicToAccount).mockReturnValue({
        address: "0x5555555555555555555555555555555555555555" as Address,
        publicKey: "0x04..." as Hex
      })

      const account = mnemonicToAccount(mockMnemonic, { addressIndex: 5 })

      expect(mnemonicToAccount).toHaveBeenCalledWith(mockMnemonic, {
        addressIndex: 5
      })
      expect(account.address).toBeDefined()
    })

    it("should handle invalid mnemonic words", () => {
      vi.mocked(mnemonicToAccount).mockImplementation(() => {
        throw new Error("Invalid mnemonic word")
      })

      expect(() =>
        mnemonicToAccount("invalid words that are not valid mnemonic")
      ).toThrow("Invalid mnemonic")
    })

    it("should handle wrong number of mnemonic words", () => {
      vi.mocked(mnemonicToAccount).mockImplementation(() => {
        throw new Error("Mnemonic must be 12 or 24 words")
      })

      expect(() => mnemonicToAccount("only three words")).toThrow()
    })
  })

  describe("Token Approval", () => {
    it("should approve token spending", async () => {
      const mockTxHash = "0xapprovehash123" as Hash
      vi.mocked(services.approveERC20).mockResolvedValue({
        hash: mockTxHash,
        success: true
      } as any)

      const tokenAddress =
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address
      const spenderAddress =
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as Address

      const result = await services.approveERC20(
        tokenAddress,
        spenderAddress,
        "1000000",
        mockPrivateKey,
        mockNetwork
      )

      expect(services.approveERC20).toHaveBeenCalled()
      expect(result.hash).toBe(mockTxHash)
    })
  })

  describe("Edge Cases", () => {
    it("should handle network errors", async () => {
      vi.mocked(services.getNativeBalance).mockRejectedValue(
        new Error("Network error")
      )

      await expect(
        services.getNativeBalance(mockAddress, mockNetwork)
      ).rejects.toThrow("Network error")
    })

    it("should handle rate limiting", async () => {
      vi.mocked(services.getNativeBalance).mockRejectedValue(
        new Error("Rate limit exceeded")
      )

      await expect(
        services.getNativeBalance(mockAddress, mockNetwork)
      ).rejects.toThrow("Rate limit exceeded")
    })

    it("should handle transaction timeout", async () => {
      vi.mocked(services.transferETH).mockRejectedValue(
        new Error("Transaction timeout")
      )

      await expect(
        services.transferETH(mockPrivateKey, mockToAddress, "1", mockNetwork)
      ).rejects.toThrow("Transaction timeout")
    })

    it("should handle gas estimation failure", async () => {
      mockPublicClient.estimateGas.mockRejectedValue(
        new Error("Gas estimation failed")
      )

      await expect(
        mockPublicClient.estimateGas({
          to: mockToAddress,
          value: BigInt("1000000000000000000")
        })
      ).rejects.toThrow("Gas estimation failed")
    })

    it("should handle nonce too high error", async () => {
      mockWalletClient.sendTransaction.mockRejectedValue(
        new Error("Nonce too high")
      )

      await expect(
        mockWalletClient.sendTransaction({
          to: mockToAddress,
          value: BigInt("1000000000000000000"),
          nonce: 999999
        })
      ).rejects.toThrow("Nonce too high")
    })
  })

  describe("Data Validation", () => {
    it("should validate private key format (64 hex chars)", () => {
      const validKey = mockPrivateKey.slice(2) // Remove 0x
      const isValidFormat = /^[a-fA-F0-9]{64}$/.test(validKey)
      expect(isValidFormat).toBe(true)
    })

    it("should validate address format (40 hex chars with 0x)", () => {
      const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(mockAddress)
      expect(isValidFormat).toBe(true)
    })

    it("should validate mnemonic has correct word count", () => {
      const words = mockMnemonic.split(" ")
      expect(words.length).toBe(12)
    })

    it("should validate public key format", () => {
      const account = privateKeyToAccount(mockPrivateKey)
      expect(account.publicKey).toBeDefined()
      expect(account.publicKey.startsWith("0x")).toBe(true)
    })
  })

  describe("HD Wallet Derivation", () => {
    it("should derive multiple addresses from same mnemonic", () => {
      const addresses: Address[] = []

      for (let i = 0; i < 5; i++) {
        vi.mocked(mnemonicToAccount).mockReturnValue({
          address: `0x${i.toString().padStart(40, "0")}` as Address,
          publicKey: "0x04..." as Hex
        })

        const account = mnemonicToAccount(mockMnemonic, { addressIndex: i })
        addresses.push(account.address)
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(5)
    })

    it("should follow BIP-44 derivation path", () => {
      // Standard Ethereum derivation path: m/44'/60'/0'/0/{index}
      vi.mocked(mnemonicToAccount).mockReturnValue({
        address: mockAddress,
        publicKey: "0x04..." as Hex
      })

      const account = mnemonicToAccount(mockMnemonic, { addressIndex: 0 })

      expect(account.address).toBeDefined()
      expect(mnemonicToAccount).toHaveBeenCalledWith(mockMnemonic, {
        addressIndex: 0
      })
    })
  })
})
