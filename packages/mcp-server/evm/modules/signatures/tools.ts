/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hex } from "viem"
import { 
  hashMessage, 
  hashTypedData, 
  verifyMessage, 
  verifyTypedData,
  recoverMessageAddress,
  recoverTypedDataAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { mcpToolRes } from "@/utils/helper.js"
import { privateKeyParam } from "../common/types.js"

// EIP-712 Domain type
const EIP712_DOMAIN_SCHEMA = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  chainId: z.number().optional(),
  verifyingContract: z.string().optional(),
  salt: z.string().optional()
})

export function registerSignaturesTools(server: McpServer) {
  // Sign message (personal_sign)
  server.tool(
    "sign_message",
    "Sign a message using personal_sign (EIP-191)",
    {
      message: z.string().describe("Message to sign"),
      privateKey: privateKeyParam
    },
    async ({ message, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const signature = await account.signMessage({ message })
        const messageHash = hashMessage(message)

        return mcpToolRes.success({
          message,
          signer: account.address,
          signature,
          messageHash,
          standard: "EIP-191 (personal_sign)"
        })
      } catch (error) {
        return mcpToolRes.error(error, "signing message")
      }
    }
  )

  // Verify message signature
  server.tool(
    "verify_message_signature",
    "Verify a personal_sign message signature",
    {
      message: z.string().describe("Original message"),
      signature: z.string().describe("Signature to verify"),
      address: z.string().describe("Expected signer address")
    },
    async ({ message, signature, address }) => {
      try {
        const isValid = await verifyMessage({
          message,
          signature: signature as Hex,
          address: address as `0x${string}`
        })

        const recoveredAddress = await recoverMessageAddress({
          message,
          signature: signature as Hex
        })

        return mcpToolRes.success({
          message,
          expectedSigner: address,
          recoveredSigner: recoveredAddress,
          isValid,
          match: recoveredAddress.toLowerCase() === address.toLowerCase()
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying message signature")
      }
    }
  )

  // Sign typed data (EIP-712)
  server.tool(
    "sign_typed_data",
    "Sign typed data using EIP-712",
    {
      domain: EIP712_DOMAIN_SCHEMA.describe("EIP-712 domain"),
      types: z.record(z.array(z.object({
        name: z.string(),
        type: z.string()
      }))).describe("Type definitions"),
      primaryType: z.string().describe("Primary type name"),
      message: z.record(z.unknown()).describe("Message to sign"),
      privateKey: privateKeyParam
    },
    async ({ domain, types, primaryType, message, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        
        const signature = await account.signTypedData({
          domain: domain as any,
          types: types as any,
          primaryType,
          message: message as any
        })

        const hash = hashTypedData({
          domain: domain as any,
          types: types as any,
          primaryType,
          message: message as any
        })

        return mcpToolRes.success({
          domain,
          primaryType,
          message,
          signer: account.address,
          signature,
          typedDataHash: hash,
          standard: "EIP-712"
        })
      } catch (error) {
        return mcpToolRes.error(error, "signing typed data")
      }
    }
  )

  // Verify typed data signature
  server.tool(
    "verify_typed_data_signature",
    "Verify an EIP-712 typed data signature",
    {
      domain: EIP712_DOMAIN_SCHEMA.describe("EIP-712 domain"),
      types: z.record(z.array(z.object({
        name: z.string(),
        type: z.string()
      }))).describe("Type definitions"),
      primaryType: z.string().describe("Primary type name"),
      message: z.record(z.unknown()).describe("Original message"),
      signature: z.string().describe("Signature to verify"),
      address: z.string().describe("Expected signer address")
    },
    async ({ domain, types, primaryType, message, signature, address }) => {
      try {
        const isValid = await verifyTypedData({
          domain: domain as any,
          types: types as any,
          primaryType,
          message: message as any,
          signature: signature as Hex,
          address: address as `0x${string}`
        })

        const recoveredAddress = await recoverTypedDataAddress({
          domain: domain as any,
          types: types as any,
          primaryType,
          message: message as any,
          signature: signature as Hex
        })

        return mcpToolRes.success({
          expectedSigner: address,
          recoveredSigner: recoveredAddress,
          isValid,
          match: recoveredAddress.toLowerCase() === address.toLowerCase()
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying typed data signature")
      }
    }
  )

  // Hash message
  server.tool(
    "hash_message",
    "Hash a message using EIP-191 format",
    {
      message: z.string().describe("Message to hash")
    },
    async ({ message }) => {
      try {
        const hash = hashMessage(message)
        return mcpToolRes.success({
          message,
          hash,
          standard: "EIP-191"
        })
      } catch (error) {
        return mcpToolRes.error(error, "hashing message")
      }
    }
  )

  // Create permit signature (EIP-2612)
  server.tool(
    "create_permit_signature",
    "Create an EIP-2612 permit signature for gasless token approvals",
    {
      tokenAddress: z.string().describe("ERC20 token address"),
      tokenName: z.string().describe("Token name (for EIP-712 domain)"),
      spender: z.string().describe("Spender address to approve"),
      value: z.string().describe("Amount to approve (in wei)"),
      nonce: z.number().describe("Current nonce for the owner"),
      deadline: z.number().describe("Permit deadline (unix timestamp)"),
      chainId: z.number().describe("Chain ID"),
      privateKey: privateKeyParam
    },
    async ({ tokenAddress, tokenName, spender, value, nonce, deadline, chainId, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)

        const domain = {
          name: tokenName,
          version: "1",
          chainId,
          verifyingContract: tokenAddress as `0x${string}`
        }

        const types = {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
          ]
        }

        const message = {
          owner: account.address,
          spender: spender as `0x${string}`,
          value: BigInt(value),
          nonce: BigInt(nonce),
          deadline: BigInt(deadline)
        }

        const signature = await account.signTypedData({
          domain,
          types,
          primaryType: "Permit",
          message
        })

        // Split signature
        const r = signature.slice(0, 66) as Hex
        const s = `0x${signature.slice(66, 130)}` as Hex
        const v = parseInt(signature.slice(130, 132), 16)

        return mcpToolRes.success({
          owner: account.address,
          spender,
          value,
          nonce,
          deadline,
          signature,
          components: { r, s, v },
          standard: "EIP-2612"
        })
      } catch (error) {
        return mcpToolRes.error(error, "creating permit signature")
      }
    }
  )

  // Recover signer from signature
  server.tool(
    "recover_signer",
    "Recover the signer address from a signature",
    {
      message: z.string().describe("Original message"),
      signature: z.string().describe("Signature")
    },
    async ({ message, signature }) => {
      try {
        const address = await recoverMessageAddress({
          message,
          signature: signature as Hex
        })

        return mcpToolRes.success({
          message,
          signature,
          recoveredAddress: address
        })
      } catch (error) {
        return mcpToolRes.error(error, "recovering signer")
      }
    }
  )
}
