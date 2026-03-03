/**
 * Comprehensive tests for signatures module tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { hashMessage, hashTypedData, keccak256, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { registerSignaturesTools } from "./tools.js"

describe("Signatures Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object; description: string }>

  // Test private key (DO NOT use in production!)
  const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY)
  const TEST_ADDRESS = TEST_ACCOUNT.address

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()

    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema, description })
      })
    } as unknown as McpServer

    registerSignaturesTools(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all signature tools", () => {
      expect(registeredTools.has("sign_message")).toBe(true)
      expect(registeredTools.has("verify_message_signature")).toBe(true)
      expect(registeredTools.has("sign_typed_data")).toBe(true)
      expect(registeredTools.has("verify_typed_data_signature")).toBe(true)
      expect(registeredTools.has("hash_message")).toBe(true)
      expect(registeredTools.has("create_permit_signature")).toBe(true)
      expect(registeredTools.has("recover_signer")).toBe(true)
    })

    it("should have correct descriptions for tools", () => {
      const signMessageTool = registeredTools.get("sign_message")
      expect(signMessageTool?.description).toBe("Sign a message using personal_sign (EIP-191)")

      const verifyTool = registeredTools.get("verify_message_signature")
      expect(verifyTool?.description).toBe("Verify a personal_sign message signature")
    })
  })

  describe("sign_message", () => {
    it("should sign a simple message", async () => {
      const tool = registeredTools.get("sign_message")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        message: "Hello, Ethereum!",
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.message).toBe("Hello, Ethereum!")
      expect(data.signer).toBe(TEST_ADDRESS)
      expect(data.signature).toBeDefined()
      expect(data.signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(data.messageHash).toBeDefined()
      expect(data.standard).toBe("EIP-191 (personal_sign)")
    })

    it("should produce consistent signatures", async () => {
      const tool = registeredTools.get("sign_message")
      
      const result1 = await tool!.handler({
        message: "Test Message",
        privateKey: TEST_PRIVATE_KEY
      })
      const data1 = JSON.parse(result1.content[0].text)

      const result2 = await tool!.handler({
        message: "Test Message",
        privateKey: TEST_PRIVATE_KEY
      })
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.signature).toBe(data2.signature)
    })

    it("should produce different signatures for different messages", async () => {
      const tool = registeredTools.get("sign_message")
      
      const result1 = await tool!.handler({
        message: "Message 1",
        privateKey: TEST_PRIVATE_KEY
      })
      const data1 = JSON.parse(result1.content[0].text)

      const result2 = await tool!.handler({
        message: "Message 2",
        privateKey: TEST_PRIVATE_KEY
      })
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.signature).not.toBe(data2.signature)
    })

    it("should include correct message hash", async () => {
      const message = "Hello, Ethereum!"
      const expectedHash = hashMessage(message)

      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.messageHash).toBe(expectedHash)
    })

    it("should handle empty message", async () => {
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: "",
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
      expect(data.message).toBe("")
    })

    it("should handle message with special characters", async () => {
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: "Special chars: 日本語 🚀 \n\t",
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should handle invalid private key", async () => {
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: "Test",
        privateKey: "0xinvalid"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("signing message")
    })
  })

  describe("verify_message_signature", () => {
    it("should verify a valid signature", async () => {
      // First sign a message
      const signTool = registeredTools.get("sign_message")
      const signResult = await signTool!.handler({
        message: "Verify me!",
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Then verify it
      const verifyTool = registeredTools.get("verify_message_signature")
      const verifyResult = await verifyTool!.handler({
        message: "Verify me!",
        signature: signData.signature,
        address: TEST_ADDRESS
      })
      const verifyData = JSON.parse(verifyResult.content[0].text)

      expect(verifyData.isValid).toBe(true)
      expect(verifyData.match).toBe(true)
      expect(verifyData.expectedSigner.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase())
      expect(verifyData.recoveredSigner.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase())
    })

    it("should reject signature with wrong message", async () => {
      // Sign a message
      const signTool = registeredTools.get("sign_message")
      const signResult = await signTool!.handler({
        message: "Original message",
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Verify with different message
      const verifyTool = registeredTools.get("verify_message_signature")
      const verifyResult = await verifyTool!.handler({
        message: "Different message",
        signature: signData.signature,
        address: TEST_ADDRESS
      })
      const verifyData = JSON.parse(verifyResult.content[0].text)

      expect(verifyData.isValid).toBe(false)
      expect(verifyData.match).toBe(false)
    })

    it("should reject signature with wrong address", async () => {
      // Sign a message
      const signTool = registeredTools.get("sign_message")
      const signResult = await signTool!.handler({
        message: "Test message",
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Verify with different address
      const wrongAddress = "0x1234567890123456789012345678901234567890"
      const verifyTool = registeredTools.get("verify_message_signature")
      const verifyResult = await verifyTool!.handler({
        message: "Test message",
        signature: signData.signature,
        address: wrongAddress
      })
      const verifyData = JSON.parse(verifyResult.content[0].text)

      expect(verifyData.isValid).toBe(false)
      expect(verifyData.match).toBe(false)
      expect(verifyData.recoveredSigner.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase())
    })

    it("should handle invalid signature format", async () => {
      const verifyTool = registeredTools.get("verify_message_signature")
      const result = await verifyTool!.handler({
        message: "Test",
        signature: "invalid_signature",
        address: TEST_ADDRESS
      })

      expect(result.content[0].text).toContain("Error")
    })
  })

  describe("sign_typed_data", () => {
    const domain = {
      name: "Test App",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    }

    const types = {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" }
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" }
      ]
    }

    const message = {
      from: {
        name: "Alice",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
      },
      contents: "Hello, Bob!"
    }

    it("should sign typed data (EIP-712)", async () => {
      const tool = registeredTools.get("sign_typed_data")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        domain,
        types,
        primaryType: "Mail",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signer).toBe(TEST_ADDRESS)
      expect(data.signature).toBeDefined()
      expect(data.signature).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(data.typedDataHash).toBeDefined()
      expect(data.standard).toBe("EIP-712")
      expect(data.primaryType).toBe("Mail")
    })

    it("should produce consistent signatures for same typed data", async () => {
      const tool = registeredTools.get("sign_typed_data")
      
      const result1 = await tool!.handler({
        domain,
        types,
        primaryType: "Mail",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data1 = JSON.parse(result1.content[0].text)

      const result2 = await tool!.handler({
        domain,
        types,
        primaryType: "Mail",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.signature).toBe(data2.signature)
    })

    it("should handle simple typed data", async () => {
      const simpleDomain = {
        name: "Simple App",
        version: "1",
        chainId: 1
      }

      const simpleTypes = {
        Message: [
          { name: "text", type: "string" }
        ]
      }

      const simpleMessage = {
        text: "Hello"
      }

      const tool = registeredTools.get("sign_typed_data")
      const result = await tool!.handler({
        domain: simpleDomain,
        types: simpleTypes,
        primaryType: "Message",
        message: simpleMessage,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should include domain in response", async () => {
      const tool = registeredTools.get("sign_typed_data")
      const result = await tool!.handler({
        domain,
        types,
        primaryType: "Mail",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.domain).toEqual(domain)
    })
  })

  describe("verify_typed_data_signature", () => {
    const domain = {
      name: "Test App",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    }

    const types = {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" }
      ]
    }

    const message = {
      name: "Alice",
      wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
    }

    it("should verify valid typed data signature", async () => {
      // First sign
      const signTool = registeredTools.get("sign_typed_data")
      const signResult = await signTool!.handler({
        domain,
        types,
        primaryType: "Person",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Then verify
      const verifyTool = registeredTools.get("verify_typed_data_signature")
      const verifyResult = await verifyTool!.handler({
        domain,
        types,
        primaryType: "Person",
        message,
        signature: signData.signature,
        address: TEST_ADDRESS
      })
      const verifyData = JSON.parse(verifyResult.content[0].text)

      expect(verifyData.isValid).toBe(true)
      expect(verifyData.match).toBe(true)
    })

    it("should reject tampered message", async () => {
      // Sign original message
      const signTool = registeredTools.get("sign_typed_data")
      const signResult = await signTool!.handler({
        domain,
        types,
        primaryType: "Person",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Verify with tampered message
      const verifyTool = registeredTools.get("verify_typed_data_signature")
      const verifyResult = await verifyTool!.handler({
        domain,
        types,
        primaryType: "Person",
        message: { ...message, name: "Bob" },
        signature: signData.signature,
        address: TEST_ADDRESS
      })
      const verifyData = JSON.parse(verifyResult.content[0].text)

      expect(verifyData.isValid).toBe(false)
    })
  })

  describe("hash_message", () => {
    it("should hash a message using EIP-191", async () => {
      const tool = registeredTools.get("hash_message")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        message: "Hello, Ethereum!"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.message).toBe("Hello, Ethereum!")
      expect(data.hash).toBe(hashMessage("Hello, Ethereum!"))
      expect(data.standard).toBe("EIP-191")
    })

    it("should produce consistent hashes", async () => {
      const tool = registeredTools.get("hash_message")
      
      const result1 = await tool!.handler({ message: "Test" })
      const result2 = await tool!.handler({ message: "Test" })

      const data1 = JSON.parse(result1.content[0].text)
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.hash).toBe(data2.hash)
    })

    it("should produce different hashes for different messages", async () => {
      const tool = registeredTools.get("hash_message")
      
      const result1 = await tool!.handler({ message: "Message 1" })
      const result2 = await tool!.handler({ message: "Message 2" })

      const data1 = JSON.parse(result1.content[0].text)
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.hash).not.toBe(data2.hash)
    })
  })

  describe("create_permit_signature", () => {
    it("should create EIP-2612 permit signature", async () => {
      const tool = registeredTools.get("create_permit_signature")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenName: "USD Coin",
        spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        value: "1000000000",
        nonce: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        chainId: 1,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.owner).toBe(TEST_ADDRESS)
      expect(data.spender).toBe("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")
      expect(data.value).toBe("1000000000")
      expect(data.signature).toBeDefined()
      expect(data.components).toBeDefined()
      expect(data.components.r).toBeDefined()
      expect(data.components.s).toBeDefined()
      expect(data.components.v).toBeDefined()
      expect(data.standard).toBe("EIP-2612")
    })

    it("should split signature into r, s, v components", async () => {
      const tool = registeredTools.get("create_permit_signature")
      const result = await tool!.handler({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenName: "USD Coin",
        spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        value: "1000000000",
        nonce: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        chainId: 1,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      // r is 32 bytes (64 hex chars + 0x prefix)
      expect(data.components.r).toMatch(/^0x[a-fA-F0-9]{64}$/)
      // s is 32 bytes
      expect(data.components.s).toMatch(/^0x[a-fA-F0-9]{64}$/)
      // v is either 27 or 28
      expect([27, 28]).toContain(data.components.v)
    })

    it("should include all permit parameters in response", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600

      const tool = registeredTools.get("create_permit_signature")
      const result = await tool!.handler({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenName: "USD Coin",
        spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        value: "1000000000",
        nonce: 5,
        deadline,
        chainId: 1,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.nonce).toBe(5)
      expect(data.deadline).toBe(deadline)
    })
  })

  describe("recover_signer", () => {
    it("should recover signer address from signature", async () => {
      // First sign a message
      const signTool = registeredTools.get("sign_message")
      const signResult = await signTool!.handler({
        message: "Recover me!",
        privateKey: TEST_PRIVATE_KEY
      })
      const signData = JSON.parse(signResult.content[0].text)

      // Then recover the signer
      const recoverTool = registeredTools.get("recover_signer")
      const recoverResult = await recoverTool!.handler({
        message: "Recover me!",
        signature: signData.signature
      })
      const recoverData = JSON.parse(recoverResult.content[0].text)

      expect(recoverData.recoveredAddress.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase())
      expect(recoverData.message).toBe("Recover me!")
      expect(recoverData.signature).toBe(signData.signature)
    })

    it("should recover different address for different private key", async () => {
      // Sign with a different private key
      const otherPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
      const otherAccount = privateKeyToAccount(otherPrivateKey)

      const signTool = registeredTools.get("sign_message")
      const signResult = await signTool!.handler({
        message: "Test",
        privateKey: otherPrivateKey
      })
      const signData = JSON.parse(signResult.content[0].text)

      const recoverTool = registeredTools.get("recover_signer")
      const recoverResult = await recoverTool!.handler({
        message: "Test",
        signature: signData.signature
      })
      const recoverData = JSON.parse(recoverResult.content[0].text)

      expect(recoverData.recoveredAddress.toLowerCase()).toBe(otherAccount.address.toLowerCase())
      expect(recoverData.recoveredAddress.toLowerCase()).not.toBe(TEST_ADDRESS.toLowerCase())
    })

    it("should handle invalid signature", async () => {
      const recoverTool = registeredTools.get("recover_signer")
      const result = await recoverTool!.handler({
        message: "Test",
        signature: "invalid"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("recovering signer")
    })
  })

  describe("Edge Cases", () => {
    it("should handle very long messages", async () => {
      const longMessage = "A".repeat(10000)
      
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: longMessage,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should handle hex string messages", async () => {
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: "0x1234567890abcdef",
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should handle newlines in messages", async () => {
      const tool = registeredTools.get("sign_message")
      const result = await tool!.handler({
        message: "Line 1\nLine 2\nLine 3",
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should handle numeric string values in typed data", async () => {
      const domain = {
        name: "Test",
        version: "1",
        chainId: 1
      }

      const types = {
        Order: [
          { name: "amount", type: "uint256" }
        ]
      }

      const message = {
        amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      }

      const tool = registeredTools.get("sign_typed_data")
      const result = await tool!.handler({
        domain,
        types,
        primaryType: "Order",
        message,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
    })

    it("should handle permit with max uint256 value", async () => {
      const tool = registeredTools.get("create_permit_signature")
      const result = await tool!.handler({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenName: "USD Coin",
        spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        value: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        nonce: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        chainId: 1,
        privateKey: TEST_PRIVATE_KEY
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBeDefined()
      expect(data.value).toBe("115792089237316195423570985008687907853269984665640564039457584007913129639935")
    })
  })
})
