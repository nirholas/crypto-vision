/**
 * NFT Module Tests
 * Tests for EVM NFT-related tools and services
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash, Hex } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getERC721TokenMetadata: vi.fn(),
  getERC1155TokenMetadata: vi.fn(),
  transferERC721: vi.fn(),
  transferERC1155: vi.fn(),
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

// Mock viem accounts
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn((key: Hex) => ({
    address: "0x1234567890123456789012345678901234567890" as Address,
    publicKey: "0x04abc123def456789012345678901234567890123456789012345678901234567890" as Hex,
    signMessage: vi.fn().mockResolvedValue("0xsignature123" as Hex),
    signTransaction: vi.fn().mockResolvedValue("0xsignedtx123" as Hex),
    signTypedData: vi.fn().mockResolvedValue("0xtypeddatasig123" as Hex)
  }))
}))

// Mock public client
const mockPublicClient = {
  readContract: vi.fn(),
  getChainId: vi.fn().mockResolvedValue(1),
  estimateGas: vi.fn(),
  getGasPrice: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  writeContract: vi.fn(),
  account: {
    address: "0x1234567890123456789012345678901234567890" as Address
  },
  chain: { id: 1, name: "Ethereum" }
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"
import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { privateKeyToAccount } from "viem/accounts"

describe("NFT Module", () => {
  beforeEach(() => {
    // cleared in beforeEach
    // Reset mock implementations
    mockPublicClient.readContract.mockReset()
    mockPublicClient.getChainId.mockReset().mockResolvedValue(1)
    mockPublicClient.estimateGas.mockReset()
    mockPublicClient.getGasPrice.mockReset()
    mockWalletClient.writeContract.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex
  const mockOwnerAddress = "0x1234567890123456789012345678901234567890" as Address
  const mockRecipientAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address
  const mockCollectionAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D" as Address
  const mockNetwork = "ethereum"
  const mockTokenId = "1234"
  const mockTxHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash

  describe("getNFTMetadata Service (getERC721TokenMetadata)", () => {
    const createMockNFTMetadata = (overrides = {}) => ({
      id: BigInt(mockTokenId),
      name: "Bored Ape Yacht Club",
      symbol: "BAYC",
      tokenURI: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1234",
      owner: mockOwnerAddress,
      totalSupply: BigInt(10000),
      network: mockNetwork,
      contractAddress: mockCollectionAddress,
      ...overrides
    })

    it("should fetch NFT metadata successfully", async () => {
      const mockMetadata = createMockNFTMetadata()
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )

      expect(services.getERC721TokenMetadata).toHaveBeenCalledWith(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )
      expect(result.name).toBe("Bored Ape Yacht Club")
      expect(result.symbol).toBe("BAYC")
      expect(result.owner).toBe(mockOwnerAddress)
    })

    it("should return tokenURI for IPFS metadata", async () => {
      const mockMetadata = createMockNFTMetadata({
        tokenURI: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1234"
      })
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )

      expect(result.tokenURI).toContain("ipfs://")
    })

    it("should handle HTTP tokenURI", async () => {
      const mockMetadata = createMockNFTMetadata({
        tokenURI: "https://metadata.example.com/token/1234"
      })
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )

      expect(result.tokenURI).toContain("https://")
    })

    it("should handle non-existent token ID", async () => {
      vi.mocked(services.getERC721TokenMetadata).mockRejectedValue(
        new Error("Token does not exist")
      )

      await expect(
        services.getERC721TokenMetadata(
          mockCollectionAddress,
          BigInt(999999999),
          mockNetwork
        )
      ).rejects.toThrow("Token does not exist")
    })

    it("should handle invalid contract address (not an NFT)", async () => {
      vi.mocked(services.getERC721TokenMetadata).mockRejectedValue(
        new Error("Token address is not a contract")
      )

      const invalidAddress = "0x0000000000000000000000000000000000000001" as Address

      await expect(
        services.getERC721TokenMetadata(invalidAddress, BigInt(1), mockNetwork)
      ).rejects.toThrow("Token address is not a contract")
    })

    it("should work with different networks", async () => {
      const networks = ["ethereum", "polygon", "arbitrum", "base"]
      const mockMetadata = createMockNFTMetadata()

      for (const network of networks) {
        vi.mocked(services.getERC721TokenMetadata).mockResolvedValue({
          ...mockMetadata,
          network
        })

        const result = await services.getERC721TokenMetadata(
          mockCollectionAddress,
          BigInt(mockTokenId),
          network
        )

        expect(result.network).toBe(network)
      }
    })

    it("should handle token ID as zero", async () => {
      const mockMetadata = createMockNFTMetadata({ id: BigInt(0) })
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(0),
        mockNetwork
      )

      expect(result.id).toBe(BigInt(0))
    })

    it("should handle very large token IDs", async () => {
      const largeTokenId = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")
      const mockMetadata = createMockNFTMetadata({ id: largeTokenId })
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        largeTokenId,
        mockNetwork
      )

      expect(result.id).toBe(largeTokenId)
    })
  })

  describe("getNFTBalance Service (balanceOf)", () => {
    it("should get NFT balance for an address", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(5))

      const balance = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "balanceOf",
        args: [mockOwnerAddress]
      })

      expect(balance).toBe(BigInt(5))
    })

    it("should return 0 for address with no NFTs", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(0))

      const balance = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "balanceOf",
        args: [mockRecipientAddress]
      })

      expect(balance).toBe(BigInt(0))
    })

    it("should handle invalid address format", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockRejectedValueOnce(
        new Error("Invalid address")
      )

      await expect(
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "balanceOf",
          args: ["invalid-address"]
        })
      ).rejects.toThrow("Invalid address")
    })

    it("should handle contract call failure", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockRejectedValueOnce(
        new Error("Contract execution reverted")
      )

      await expect(
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "balanceOf",
          args: [mockOwnerAddress]
        })
      ).rejects.toThrow("Contract execution reverted")
    })

    it("should handle large balance counts", async () => {
      // cleared in beforeEach
      const largeBalance = BigInt(10000)
      mockPublicClient.readContract.mockResolvedValueOnce(largeBalance)

      const balance = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "balanceOf",
        args: [mockOwnerAddress]
      })

      expect(balance).toBe(largeBalance)
    })
  })

  describe("getNFTOwner Service (ownerOf)", () => {
    it("should get the current owner of an NFT", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockResolvedValueOnce(mockOwnerAddress)

      const owner = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "ownerOf",
        args: [BigInt(mockTokenId)]
      })

      expect(owner).toBe(mockOwnerAddress)
    })

    it("should handle non-existent token ID", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockRejectedValueOnce(
        new Error("ERC721: invalid token ID")
      )

      await expect(
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "ownerOf",
          args: [BigInt(999999999)]
        })
      ).rejects.toThrow("ERC721: invalid token ID")
    })

    it("should handle burned tokens", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockRejectedValueOnce(
        new Error("ERC721: owner query for nonexistent token")
      )

      await expect(
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "ownerOf",
          args: [BigInt(mockTokenId)]
        })
      ).rejects.toThrow("ERC721: owner query for nonexistent token")
    })

    it("should return consistent owner for same token", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract
        .mockResolvedValueOnce(mockOwnerAddress)
        .mockResolvedValueOnce(mockOwnerAddress)

      const owner1 = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "ownerOf",
        args: [BigInt(mockTokenId)]
      })

      const owner2 = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "ownerOf",
        args: [BigInt(mockTokenId)]
      })

      expect(owner1).toBe(owner2)
    })
  })

  describe("getNFTCollectionInfo Service", () => {
    it("should get comprehensive collection info", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce("Bored Ape Yacht Club") // name
        .mockResolvedValueOnce("BAYC") // symbol
        .mockResolvedValueOnce(BigInt(10000)) // totalSupply

      const [name, symbol, totalSupply] = await Promise.all([
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "name"
        }),
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "symbol"
        }),
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "totalSupply"
        })
      ])

      expect(name).toBe("Bored Ape Yacht Club")
      expect(symbol).toBe("BAYC")
      expect(totalSupply).toBe(BigInt(10000))
    })

    it("should handle collection without totalSupply", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract
        .mockResolvedValueOnce("CryptoPunks")
        .mockResolvedValueOnce("PUNK")
        .mockRejectedValueOnce(new Error("function not found"))

      const name = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "name"
      })

      const symbol = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "symbol"
      })

      expect(name).toBe("CryptoPunks")
      expect(symbol).toBe("PUNK")
    })

    it("should handle contracts with missing name/symbol", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("function not found"))

      await expect(
        mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "name"
        })
      ).rejects.toThrow("function not found")
    })

    it("should handle zero total supply", async () => {
      // cleared in beforeEach
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(0))

      const totalSupply = await mockPublicClient.readContract({
        address: mockCollectionAddress,
        abi: expect.any(Array),
        functionName: "totalSupply"
      })

      expect(totalSupply).toBe(BigInt(0))
    })
  })

  describe("transferNFT Service (transferERC721)", () => {
    const createMockTransferResult = (overrides = {}) => ({
      txHash: mockTxHash,
      tokenId: mockTokenId,
      token: {
        name: "Bored Ape Yacht Club",
        symbol: "BAYC"
      },
      ...overrides
    })

    it("should transfer NFT successfully", async () => {
      const mockResult = createMockTransferResult()
      vi.mocked(services.transferERC721).mockResolvedValue(mockResult)

      const result = await services.transferERC721(
        mockCollectionAddress,
        mockRecipientAddress,
        BigInt(mockTokenId),
        mockPrivateKey,
        mockNetwork
      )

      expect(services.transferERC721).toHaveBeenCalledWith(
        mockCollectionAddress,
        mockRecipientAddress,
        BigInt(mockTokenId),
        mockPrivateKey,
        mockNetwork
      )
      expect(result.txHash).toBe(mockTxHash)
      expect(result.tokenId).toBe(mockTokenId)
    })

    it("should handle private key without 0x prefix", async () => {
      const mockResult = createMockTransferResult()
      vi.mocked(services.transferERC721).mockResolvedValue(mockResult)

      const privateKeyWithoutPrefix = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

      const result = await services.transferERC721(
        mockCollectionAddress,
        mockRecipientAddress,
        BigInt(mockTokenId),
        privateKeyWithoutPrefix,
        mockNetwork
      )

      expect(result.txHash).toBe(mockTxHash)
    })

    it("should handle transfer of non-owned NFT", async () => {
      vi.mocked(services.transferERC721).mockRejectedValue(
        new Error("ERC721: transfer caller is not owner nor approved")
      )

      await expect(
        services.transferERC721(
          mockCollectionAddress,
          mockRecipientAddress,
          BigInt(mockTokenId),
          mockPrivateKey,
          mockNetwork
        )
      ).rejects.toThrow("ERC721: transfer caller is not owner nor approved")
    })

    it("should handle transfer to zero address", async () => {
      vi.mocked(services.transferERC721).mockRejectedValue(
        new Error("ERC721: transfer to the zero address")
      )

      const zeroAddress = "0x0000000000000000000000000000000000000000" as Address

      await expect(
        services.transferERC721(
          mockCollectionAddress,
          zeroAddress,
          BigInt(mockTokenId),
          mockPrivateKey,
          mockNetwork
        )
      ).rejects.toThrow("ERC721: transfer to the zero address")
    })

    it("should handle insufficient gas", async () => {
      vi.mocked(services.transferERC721).mockRejectedValue(
        new Error("Insufficient funds for gas")
      )

      await expect(
        services.transferERC721(
          mockCollectionAddress,
          mockRecipientAddress,
          BigInt(mockTokenId),
          mockPrivateKey,
          mockNetwork
        )
      ).rejects.toThrow("Insufficient funds for gas")
    })

    it("should return token details in transfer result", async () => {
      const mockResult = createMockTransferResult({
        token: {
          name: "Mutant Ape Yacht Club",
          symbol: "MAYC"
        }
      })
      vi.mocked(services.transferERC721).mockResolvedValue(mockResult)

      const result = await services.transferERC721(
        mockCollectionAddress,
        mockRecipientAddress,
        BigInt(mockTokenId),
        mockPrivateKey,
        mockNetwork
      )

      expect(result.token.name).toBe("Mutant Ape Yacht Club")
      expect(result.token.symbol).toBe("MAYC")
    })

    it("should work with different networks", async () => {
      const networks = ["ethereum", "polygon", "arbitrum", "base", "optimism"]
      const mockResult = createMockTransferResult()

      for (const network of networks) {
        vi.mocked(services.transferERC721).mockResolvedValue(mockResult)

        await services.transferERC721(
          mockCollectionAddress,
          mockRecipientAddress,
          BigInt(mockTokenId),
          mockPrivateKey,
          network
        )

        expect(services.transferERC721).toHaveBeenCalledWith(
          mockCollectionAddress,
          mockRecipientAddress,
          BigInt(mockTokenId),
          mockPrivateKey,
          network
        )
      }
    })
  })

  describe("ERC1155 Token Operations", () => {
    const mockERC1155Address = "0x76BE3b62873462d2142405439777e971754E8E77" as Address

    describe("getERC1155TokenMetadata", () => {
      it("should fetch ERC1155 token metadata successfully", async () => {
        const mockMetadata = {
          id: BigInt(mockTokenId),
          name: "OpenSea Shared Storefront",
          tokenURI: "https://api.opensea.io/api/v1/metadata/{id}",
          network: mockNetwork,
          contractAddress: mockERC1155Address
        }
        vi.mocked(services.getERC1155TokenMetadata).mockResolvedValue(mockMetadata)

        const result = await services.getERC1155TokenMetadata(
          mockERC1155Address,
          BigInt(mockTokenId),
          mockNetwork
        )

        expect(result.name).toBe("OpenSea Shared Storefront")
        expect(result.tokenURI).toContain("{id}")
      })

      it("should handle non-existent ERC1155 token", async () => {
        vi.mocked(services.getERC1155TokenMetadata).mockRejectedValue(
          new Error("URI query for nonexistent token")
        )

        await expect(
          services.getERC1155TokenMetadata(
            mockERC1155Address,
            BigInt(999999999),
            mockNetwork
          )
        ).rejects.toThrow("URI query for nonexistent token")
      })
    })

    describe("transferERC1155", () => {
      it("should transfer ERC1155 tokens successfully", async () => {
        const mockResult = {
          txHash: mockTxHash,
          tokenId: mockTokenId,
          amount: "10"
        }
        vi.mocked(services.transferERC1155).mockResolvedValue(mockResult)

        const result = await services.transferERC1155(
          mockERC1155Address,
          mockRecipientAddress,
          BigInt(mockTokenId),
          "10",
          mockPrivateKey,
          mockNetwork
        )

        expect(result.txHash).toBe(mockTxHash)
        expect(result.amount).toBe("10")
      })

      it("should handle insufficient balance for transfer", async () => {
        vi.mocked(services.transferERC1155).mockRejectedValue(
          new Error("ERC1155: insufficient balance for transfer")
        )

        await expect(
          services.transferERC1155(
            mockERC1155Address,
            mockRecipientAddress,
            BigInt(mockTokenId),
            "1000000",
            mockPrivateKey,
            mockNetwork
          )
        ).rejects.toThrow("ERC1155: insufficient balance for transfer")
      })
    })
  })

  describe("NFT Approval Operations", () => {
    describe("approve", () => {
      it("should approve NFT for specific token", async () => {
        // cleared in beforeEach
        const operatorAddress = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as Address
        mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

        const hash = await mockWalletClient.writeContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "approve",
          args: [operatorAddress, BigInt(mockTokenId)],
          account: mockWalletClient.account
        })

        expect(hash).toBe(mockTxHash)
      })

      it("should set approval for all tokens", async () => {
        // cleared in beforeEach
        const operatorAddress = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as Address
        mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

        const hash = await mockWalletClient.writeContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "setApprovalForAll",
          args: [operatorAddress, true],
          account: mockWalletClient.account
        })

        expect(hash).toBe(mockTxHash)
      })
    })

    describe("isApprovedForAll", () => {
      it("should check if operator is approved for all", async () => {
        // cleared in beforeEach
        const operatorAddress = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as Address
        mockPublicClient.readContract.mockResolvedValueOnce(true)

        const isApproved = await mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "isApprovedForAll",
          args: [mockOwnerAddress, operatorAddress]
        })

        expect(isApproved).toBe(true)
      })

      it("should return false for non-approved operator", async () => {
        // cleared in beforeEach
        const operatorAddress = "0x1111111111111111111111111111111111111111" as Address
        mockPublicClient.readContract.mockResolvedValueOnce(false)

        const isApproved = await mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "isApprovedForAll",
          args: [mockOwnerAddress, operatorAddress]
        })

        expect(isApproved).toBe(false)
      })
    })

    describe("getApproved", () => {
      it("should get approved address for specific token", async () => {
        // cleared in beforeEach
        const approvedAddress = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as Address
        mockPublicClient.readContract.mockResolvedValueOnce(approvedAddress)

        const approved = await mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "getApproved",
          args: [BigInt(mockTokenId)]
        })

        expect(approved).toBe(approvedAddress)
      })

      it("should return zero address for non-approved token", async () => {
        // cleared in beforeEach
        const zeroAddress = "0x0000000000000000000000000000000000000000" as Address
        mockPublicClient.readContract.mockResolvedValueOnce(zeroAddress)

        const approved = await mockPublicClient.readContract({
          address: mockCollectionAddress,
          abi: expect.any(Array),
          functionName: "getApproved",
          args: [BigInt(mockTokenId)]
        })

        expect(approved).toBe(zeroAddress)
      })
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should handle network timeout", async () => {
      vi.mocked(services.getERC721TokenMetadata).mockRejectedValue(
        new Error("Request timeout")
      )

      await expect(
        services.getERC721TokenMetadata(
          mockCollectionAddress,
          BigInt(mockTokenId),
          mockNetwork
        )
      ).rejects.toThrow("Request timeout")
    })

    it("should handle RPC error", async () => {
      vi.mocked(services.getERC721TokenMetadata).mockRejectedValue(
        new Error("JSON-RPC error: Internal error")
      )

      await expect(
        services.getERC721TokenMetadata(
          mockCollectionAddress,
          BigInt(mockTokenId),
          mockNetwork
        )
      ).rejects.toThrow("JSON-RPC error")
    })

    it("should handle invalid private key", async () => {
      vi.mocked(services.transferERC721).mockRejectedValue(
        new Error("Invalid private key")
      )

      await expect(
        services.transferERC721(
          mockCollectionAddress,
          mockRecipientAddress,
          BigInt(mockTokenId),
          "invalid-key",
          mockNetwork
        )
      ).rejects.toThrow("Invalid private key")
    })

    it("should handle contract not supporting ERC721", async () => {
      vi.mocked(services.getERC721TokenMetadata).mockRejectedValue(
        new Error("Contract does not implement ERC721")
      )

      const nonNFTContract = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address // USDT

      await expect(
        services.getERC721TokenMetadata(nonNFTContract, BigInt(1), mockNetwork)
      ).rejects.toThrow("Contract does not implement ERC721")
    })

    it("should handle empty tokenURI", async () => {
      const mockMetadata = {
        id: BigInt(mockTokenId),
        name: "Test Collection",
        symbol: "TEST",
        tokenURI: "",
        owner: mockOwnerAddress,
        totalSupply: BigInt(100),
        network: mockNetwork,
        contractAddress: mockCollectionAddress
      }
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )

      expect(result.tokenURI).toBe("")
    })

    it("should handle data URI tokenURI", async () => {
      const dataUri = "data:application/json;base64,eyJuYW1lIjoiVGVzdCBORlQifQ=="
      const mockMetadata = {
        id: BigInt(mockTokenId),
        name: "On-chain Collection",
        symbol: "ONCHAIN",
        tokenURI: dataUri,
        owner: mockOwnerAddress,
        totalSupply: BigInt(100),
        network: mockNetwork,
        contractAddress: mockCollectionAddress
      }
      vi.mocked(services.getERC721TokenMetadata).mockResolvedValue(mockMetadata)

      const result = await services.getERC721TokenMetadata(
        mockCollectionAddress,
        BigInt(mockTokenId),
        mockNetwork
      )

      expect(result.tokenURI).toContain("data:application/json")
    })
  })
})
