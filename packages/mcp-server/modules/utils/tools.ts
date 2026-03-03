/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import {
  keccak256,
  toHex,
  fromHex,
  isAddress,
  getAddress,
  encodePacked,
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbiParameters,
  concat,
  slice,
  pad,
  size,
  hashMessage,
  recoverMessageAddress,
  verifyMessage,
  hashTypedData,
  recoverTypedDataAddress,
  getContractAddress,
  getCreate2Address
} from "viem"
import { generateMnemonic, mnemonicToAccount, privateKeyToAccount, english, signMessage } from "viem/accounts"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "@/evm/modules/common/types.js"

export function registerUtilityTools(server: McpServer) {
  // Keccak256 hash
  server.tool(
    "keccak256_hash",
    "Compute the Keccak-256 hash of a value. Used for hashing in Ethereum (function selectors, event topics, etc.)",
    {
      value: z.string().describe("The value to hash (string or hex)"),
      type: z
        .enum(["string", "hex"])
        .default("string")
        .describe("Type of input: 'string' for text, 'hex' for hex bytes")
    },
    async ({ value, type }) => {
      try {
        let hash: Hex
        if (type === "hex") {
          hash = keccak256(value as Hex)
        } else {
          hash = keccak256(toHex(value))
        }

        return mcpToolRes.success({
          input: value,
          inputType: type,
          hash
        })
      } catch (error) {
        return mcpToolRes.error(error, "computing keccak256 hash")
      }
    }
  )

  // Get storage at slot
  server.tool(
    "get_storage_at",
    "Read raw storage from a contract at a specific slot. Useful for reading private variables or understanding contract state.",
    {
      address: z.string().describe("The contract address"),
      slot: z
        .string()
        .describe(
          "The storage slot to read (hex string, e.g., '0x0' for slot 0)"
        ),
      network: defaultNetworkParam
    },
    async ({ address, slot, network }) => {
      try {
        const client = getPublicClient(network)
        const value = await client.getStorageAt({
          address: address as Address,
          slot: slot as Hex
        })

        return mcpToolRes.success({
          address,
          slot,
          value,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "reading storage slot")
      }
    }
  )

  // Get contract bytecode
  server.tool(
    "get_contract_bytecode",
    "Get the deployed bytecode of a contract. Returns empty if address is an EOA.",
    {
      address: z.string().describe("The contract address"),
      network: defaultNetworkParam
    },
    async ({ address, network }) => {
      try {
        const client = getPublicClient(network)
        const bytecode = await client.getCode({
          address: address as Address
        })

        return mcpToolRes.success({
          address,
          bytecode: bytecode || "0x",
          isContract: bytecode !== undefined && bytecode !== "0x",
          size: bytecode ? size(bytecode) : 0,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching contract bytecode")
      }
    }
  )

  // Generate mnemonic
  server.tool(
    "generate_mnemonic",
    "Generate a new BIP-39 mnemonic phrase for wallet creation",
    {
      wordCount: z
        .enum(["12", "15", "18", "21", "24"])
        .default("12")
        .describe("Number of words in the mnemonic (12, 15, 18, 21, or 24)")
    },
    async ({ wordCount }) => {
      try {
        // Map word count to strength
        const strengthMap: Record<string, 128 | 160 | 192 | 224 | 256> = {
          "12": 128,
          "15": 160,
          "18": 192,
          "21": 224,
          "24": 256
        }

        const mnemonic = generateMnemonic(english, strengthMap[wordCount])
        const account = mnemonicToAccount(mnemonic)

        return mcpToolRes.success({
          mnemonic,
          wordCount: parseInt(wordCount),
          address: account.address,
          warning:
            "KEEP THIS MNEMONIC SECURE! Anyone with access to it can control your funds."
        })
      } catch (error) {
        return mcpToolRes.error(error, "generating mnemonic")
      }
    }
  )

  // Derive address from mnemonic
  server.tool(
    "derive_address_from_mnemonic",
    "Derive an address from a mnemonic phrase with optional HD path",
    {
      mnemonic: z.string().describe("The BIP-39 mnemonic phrase"),
      accountIndex: z
        .number()
        .default(0)
        .describe("Account index for derivation (default: 0)"),
      addressIndex: z
        .number()
        .default(0)
        .describe("Address index for derivation (default: 0)")
    },
    async ({ mnemonic, accountIndex, addressIndex }) => {
      try {
        const account = mnemonicToAccount(mnemonic, {
          accountIndex,
          addressIndex
        })

        return mcpToolRes.success({
          address: account.address,
          accountIndex,
          addressIndex,
          path: `m/44'/60'/${accountIndex}'/0/${addressIndex}`
        })
      } catch (error) {
        return mcpToolRes.error(error, "deriving address from mnemonic")
      }
    }
  )

  // Validate address
  server.tool(
    "validate_address",
    "Validate an Ethereum address and return its checksum version",
    {
      address: z.string().describe("The address to validate")
    },
    async ({ address }) => {
      try {
        const valid = isAddress(address)
        let checksummed: string | null = null

        if (valid) {
          checksummed = getAddress(address)
        }

        return mcpToolRes.success({
          input: address,
          isValid: valid,
          checksumAddress: checksummed,
          isChecksumValid: valid ? address === checksummed : false
        })
      } catch (error) {
        return mcpToolRes.error(error, "validating address")
      }
    }
  )

  // Encode packed data
  server.tool(
    "encode_packed",
    "Encode values using Solidity's abi.encodePacked (non-standard packed encoding)",
    {
      types: z
        .array(z.string())
        .describe("Array of Solidity types (e.g., ['address', 'uint256'])"),
      values: z
        .array(z.any())
        .describe("Array of values corresponding to the types")
    },
    async ({ types, values }) => {
      try {
        const encoded = encodePacked(types as any, values as any)

        return mcpToolRes.success({
          types,
          values,
          encoded,
          byteLength: size(encoded)
        })
      } catch (error) {
        return mcpToolRes.error(error, "encoding packed data")
      }
    }
  )

  // ABI encode parameters
  server.tool(
    "abi_encode",
    "ABI encode parameters (standard Solidity encoding)",
    {
      types: z
        .array(z.string())
        .describe("Array of Solidity types (e.g., ['address', 'uint256'])"),
      values: z
        .array(z.any())
        .describe("Array of values corresponding to the types")
    },
    async ({ types, values }) => {
      try {
        const params = parseAbiParameters(types.join(", "))
        const encoded = encodeAbiParameters(params, values as any)

        return mcpToolRes.success({
          types,
          values,
          encoded,
          byteLength: size(encoded)
        })
      } catch (error) {
        return mcpToolRes.error(error, "ABI encoding")
      }
    }
  )

  // ABI decode parameters
  server.tool(
    "abi_decode",
    "ABI decode encoded data back to values",
    {
      types: z
        .array(z.string())
        .describe("Array of Solidity types (e.g., ['address', 'uint256'])"),
      data: z.string().describe("The encoded data as hex string")
    },
    async ({ types, data }) => {
      try {
        const params = parseAbiParameters(types.join(", "))
        const decoded = decodeAbiParameters(params, data as Hex)

        return mcpToolRes.success({
          types,
          data,
          decoded: decoded.map((v) =>
            typeof v === "bigint" ? v.toString() : v
          )
        })
      } catch (error) {
        return mcpToolRes.error(error, "ABI decoding")
      }
    }
  )

  // Hex utilities
  server.tool(
    "hex_to_number",
    "Convert a hex string to a decimal number",
    {
      hex: z.string().describe("The hex string to convert (e.g., '0x1a')")
    },
    async ({ hex }) => {
      try {
        const num = fromHex(hex as Hex, "bigint")

        return mcpToolRes.success({
          hex,
          decimal: num.toString(),
          number: Number(num) <= Number.MAX_SAFE_INTEGER ? Number(num) : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "converting hex to number")
      }
    }
  )

  server.tool(
    "number_to_hex",
    "Convert a decimal number to a hex string",
    {
      number: z.string().describe("The decimal number to convert")
    },
    async ({ number }) => {
      try {
        const hex = toHex(BigInt(number))

        return mcpToolRes.success({
          decimal: number,
          hex
        })
      } catch (error) {
        return mcpToolRes.error(error, "converting number to hex")
      }
    }
  )

  // Compute function selector
  server.tool(
    "get_function_selector",
    "Compute the 4-byte function selector for a Solidity function signature",
    {
      signature: z
        .string()
        .describe(
          "The function signature (e.g., 'transfer(address,uint256)')"
        )
    },
    async ({ signature }) => {
      try {
        const hash = keccak256(toHex(signature))
        const selector = slice(hash, 0, 4)

        return mcpToolRes.success({
          signature,
          fullHash: hash,
          selector
        })
      } catch (error) {
        return mcpToolRes.error(error, "computing function selector")
      }
    }
  )

  // Compute event topic
  server.tool(
    "get_event_topic",
    "Compute the topic0 hash for a Solidity event signature",
    {
      signature: z
        .string()
        .describe(
          "The event signature (e.g., 'Transfer(address,address,uint256)')"
        )
    },
    async ({ signature }) => {
      try {
        const topic = keccak256(toHex(signature))

        return mcpToolRes.success({
          signature,
          topic0: topic
        })
      } catch (error) {
        return mcpToolRes.error(error, "computing event topic")
      }
    }
  )

  // Pad hex data
  server.tool(
    "pad_hex",
    "Pad a hex value to a specific byte size (for ABI encoding)",
    {
      hex: z.string().describe("The hex string to pad"),
      size: z.number().default(32).describe("Target size in bytes (default: 32)"),
      direction: z
        .enum(["left", "right"])
        .default("left")
        .describe("Padding direction")
    },
    async ({ hex, size: targetSize, direction }) => {
      try {
        const padded = pad(hex as Hex, {
          size: targetSize,
          dir: direction
        })

        return mcpToolRes.success({
          input: hex,
          padded,
          size: targetSize,
          direction
        })
      } catch (error) {
        return mcpToolRes.error(error, "padding hex data")
      }
    }
  )

  // Concat hex data
  server.tool(
    "concat_hex",
    "Concatenate multiple hex strings together",
    {
      hexStrings: z
        .array(z.string())
        .describe("Array of hex strings to concatenate")
    },
    async ({ hexStrings }) => {
      try {
        const result = concat(hexStrings as Hex[])

        return mcpToolRes.success({
          inputs: hexStrings,
          result,
          byteLength: size(result)
        })
      } catch (error) {
        return mcpToolRes.error(error, "concatenating hex data")
      }
    }
  )

  // Slice hex data
  server.tool(
    "slice_hex",
    "Extract a portion of hex data",
    {
      hex: z.string().describe("The hex string to slice"),
      start: z.number().describe("Start byte position (0-indexed)"),
      end: z.number().optional().describe("End byte position (exclusive)")
    },
    async ({ hex, start, end }) => {
      try {
        const result = slice(hex as Hex, start, end)

        return mcpToolRes.success({
          input: hex,
          start,
          end: end || size(hex as Hex),
          result
        })
      } catch (error) {
        return mcpToolRes.error(error, "slicing hex data")
      }
    }
  )

  // Sign message with private key
  server.tool(
    "sign_message",
    "Sign an arbitrary message with a private key (EIP-191 personal sign)",
    {
      message: z.string().describe("Message to sign"),
      privateKey: z.string().describe("Private key for signing")
    },
    async ({ message, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        const signature = await account.signMessage({ message })
        const messageHash = hashMessage(message)

        return mcpToolRes.success({
          message,
          signer: account.address,
          signature,
          messageHash,
          signatureLength: signature.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "signing message")
      }
    }
  )

  // Verify message signature
  server.tool(
    "verify_signature",
    "Verify a message signature and recover the signer address",
    {
      message: z.string().describe("Original message that was signed"),
      signature: z.string().describe("Signature to verify (hex string)"),
      expectedAddress: z.string().optional().describe("Expected signer address for validation")
    },
    async ({ message, signature, expectedAddress }) => {
      try {
        const recoveredAddress = await recoverMessageAddress({
          message,
          signature: signature as Hex
        })

        const isValid = expectedAddress 
          ? recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
          : true
        const messageHash = hashMessage(message)

        return mcpToolRes.success({
          message,
          signature,
          recoveredAddress,
          messageHash,
          isValid,
          validation: expectedAddress
            ? isValid 
              ? "Signature is valid for the expected address"
              : `Signature does NOT match expected address ${expectedAddress}`
            : "Signer address recovered successfully"
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying signature")
      }
    }
  )

  // Compute contract deployment address
  server.tool(
    "compute_contract_address",
    "Compute the address where a contract will be deployed (CREATE opcode)",
    {
      deployer: z.string().describe("Address that will deploy the contract"),
      nonce: z.number().describe("Transaction nonce of the deployer")
    },
    async ({ deployer, nonce }) => {
      try {
        const predictedAddress = getContractAddress({
          from: deployer as Address,
          nonce: BigInt(nonce)
        })

        return mcpToolRes.success({
          deployer,
          nonce,
          predictedAddress,
          note: "Address where contract will be deployed with CREATE opcode"
        })
      } catch (error) {
        return mcpToolRes.error(error, "computing contract address")
      }
    }
  )

  // Compute CREATE2 address
  server.tool(
    "compute_create2_address",
    "Compute deterministic contract address for CREATE2 deployment",
    {
      factory: z.string().describe("Factory/deployer contract address"),
      salt: z.string().describe("32-byte salt (hex) or string to hash"),
      initCodeHash: z.string().describe("Keccak256 hash of init code (bytecode + constructor args)")
    },
    async ({ factory, salt, initCodeHash }) => {
      try {
        // Process salt
        let saltBytes: Hex
        if (salt.startsWith("0x") && salt.length === 66) {
          saltBytes = salt as Hex
        } else {
          saltBytes = keccak256(toHex(salt))
        }

        const predictedAddress = getCreate2Address({
          from: factory as Address,
          salt: saltBytes,
          bytecodeHash: initCodeHash as Hex
        })

        return mcpToolRes.success({
          factory,
          salt: saltBytes,
          initCodeHash,
          predictedAddress,
          note: "Deterministic address for CREATE2 deployment"
        })
      } catch (error) {
        return mcpToolRes.error(error, "computing CREATE2 address")
      }
    }
  )

  // Hash typed data (EIP-712)
  server.tool(
    "hash_typed_data",
    "Hash typed structured data according to EIP-712",
    {
      domain: z.object({
        name: z.string().optional(),
        version: z.string().optional(),
        chainId: z.number().optional(),
        verifyingContract: z.string().optional(),
        salt: z.string().optional()
      }).describe("EIP-712 domain separator"),
      types: z.record(z.array(z.object({
        name: z.string(),
        type: z.string()
      }))).describe("Type definitions"),
      primaryType: z.string().describe("Primary type name"),
      message: z.record(z.any()).describe("Message data to hash")
    },
    async ({ domain, types, primaryType, message }) => {
      try {
        const hash = hashTypedData({
          domain: domain as any,
          types: types as any,
          primaryType,
          message
        })

        return mcpToolRes.success({
          domain,
          primaryType,
          hash,
          note: "EIP-712 typed data hash for signing"
        })
      } catch (error) {
        return mcpToolRes.error(error, "hashing typed data")
      }
    }
  )

  // Parse units
  server.tool(
    "parse_units",
    "Convert a human-readable value to its smallest unit (e.g., ETH to wei)",
    {
      value: z.string().describe("Human-readable value (e.g., '1.5')"),
      decimals: z.number().default(18).describe("Number of decimals (18 for ETH, 6 for USDC)")
    },
    async ({ value, decimals }) => {
      try {
        const multiplier = 10n ** BigInt(decimals)
        const [whole, fraction = ""] = value.split(".")
        const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals)
        const result = BigInt(whole) * multiplier + BigInt(paddedFraction)

        return mcpToolRes.success({
          input: value,
          decimals,
          result: result.toString(),
          hex: toHex(result)
        })
      } catch (error) {
        return mcpToolRes.error(error, "parsing units")
      }
    }
  )

  // Format units
  server.tool(
    "format_units",
    "Convert smallest unit value to human-readable format (e.g., wei to ETH)",
    {
      value: z.string().describe("Value in smallest unit (e.g., wei)"),
      decimals: z.number().default(18).describe("Number of decimals")
    },
    async ({ value, decimals }) => {
      try {
        const bigValue = BigInt(value)
        const multiplier = 10n ** BigInt(decimals)
        const whole = bigValue / multiplier
        const fraction = bigValue % multiplier
        
        const fractionStr = fraction.toString().padStart(decimals, "0")
        const trimmedFraction = fractionStr.replace(/0+$/, "")
        
        const result = trimmedFraction 
          ? `${whole}.${trimmedFraction}`
          : whole.toString()

        return mcpToolRes.success({
          input: value,
          decimals,
          result
        })
      } catch (error) {
        return mcpToolRes.error(error, "formatting units")
      }
    }
  )

  // Get chain ID
  server.tool(
    "get_chain_id",
    "Get the chain ID for a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const client = getPublicClient(network)
        const chainId = await client.getChainId()

        const chainNames: Record<number, string> = {
          1: "Ethereum Mainnet",
          56: "BNB Smart Chain",
          137: "Polygon",
          42161: "Arbitrum One",
          10: "Optimism",
          8453: "Base",
          43114: "Avalanche C-Chain",
          250: "Fantom Opera",
          11155111: "Sepolia Testnet",
          97: "BSC Testnet",
          80001: "Mumbai Testnet"
        }

        return mcpToolRes.success({
          network,
          chainId,
          chainName: chainNames[chainId] || "Unknown"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting chain ID")
      }
    }
  )
}
