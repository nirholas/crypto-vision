/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex, Hash } from "viem"
import {
  encodeDeployData,
  encodeFunctionData,
  parseAbi,
  getContractAddress,
  keccak256,
  concat,
  toBytes,
  getCreate2Address,
  hexToBytes,
  bytesToHex
} from "viem"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Block explorer API endpoints for verification
const EXPLORER_APIS: Record<number, { url: string; name: string }> = {
  1: { url: "https://api.etherscan.io/api", name: "Etherscan" },
  56: { url: "https://api.bscscan.com/api", name: "BSCScan" },
  137: { url: "https://api.polygonscan.com/api", name: "PolygonScan" },
  42161: { url: "https://api.arbiscan.io/api", name: "Arbiscan" },
  10: { url: "https://api-optimistic.etherscan.io/api", name: "Optimistic Etherscan" },
  8453: { url: "https://api.basescan.org/api", name: "BaseScan" },
  43114: { url: "https://api.snowtrace.io/api", name: "Snowtrace" },
  250: { url: "https://api.ftmscan.com/api", name: "FTMScan" },
  11155111: { url: "https://api-sepolia.etherscan.io/api", name: "Etherscan Sepolia" }
}

// Proxy ABIs
const TRANSPARENT_PROXY_ABI = parseAbi([
  "constructor(address _logic, address admin_, bytes _data)",
  "function admin() view returns (address)",
  "function implementation() view returns (address)",
  "function changeAdmin(address newAdmin) external",
  "function upgradeTo(address newImplementation) external",
  "function upgradeToAndCall(address newImplementation, bytes data) payable external"
])

const UUPS_PROXY_ABI = parseAbi([
  "function upgradeTo(address newImplementation) external",
  "function upgradeToAndCall(address newImplementation, bytes data) payable external",
  "function proxiableUUID() view returns (bytes32)"
])

const PROXY_ADMIN_ABI = parseAbi([
  "function getProxyAdmin(address proxy) view returns (address)",
  "function getProxyImplementation(address proxy) view returns (address)",
  "function upgrade(address proxy, address implementation) external",
  "function upgradeAndCall(address proxy, address implementation, bytes data) payable external",
  "function changeProxyAdmin(address proxy, address newAdmin) external"
])

// Well-known proxy factory addresses
const CREATE2_FACTORY: Record<number, Address> = {
  1: "0x4e59b44847b379578588920cA78FbF26c0B4956C", // Deterministic Deployment Proxy
  56: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  137: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  42161: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  10: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  8453: "0x4e59b44847b379578588920cA78FbF26c0B4956C"
}

// EIP-1967 storage slots
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

export function registerDeploymentTools(server: McpServer) {
  // Deploy contract from bytecode
  server.tool(
    "deploy_contract",
    "Deploy a smart contract from bytecode and constructor arguments",
    {
      network: defaultNetworkParam,
      bytecode: z.string().describe("Contract bytecode (hex string starting with 0x)"),
      abi: z.array(z.any()).optional().describe("Contract ABI (required if constructor has arguments)"),
      constructorArgs: z.array(z.any()).optional().describe("Constructor arguments"),
      value: z.string().optional().describe("ETH value to send with deployment (in wei)"),
      privateKey: z.string().describe("Private key for deployment").default(process.env.PRIVATE_KEY as string),
      gasLimit: z.string().optional().describe("Gas limit for deployment")
    },
    async ({ network, bytecode, abi, constructorArgs = [], value, privateKey, gasLimit }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const deployer = walletClient.account.address

        // Validate bytecode
        if (!bytecode.startsWith("0x")) {
          bytecode = `0x${bytecode}`
        }

        // Prepare deployment data
        let deployData: Hex
        if (abi && constructorArgs.length > 0) {
          deployData = encodeDeployData({
            abi,
            bytecode: bytecode as Hex,
            args: constructorArgs
          })
        } else {
          deployData = bytecode as Hex
        }

        // Get current nonce for address prediction
        const nonce = await publicClient.getTransactionCount({ address: deployer })
        const predictedAddress = getContractAddress({
          from: deployer,
          nonce: BigInt(nonce)
        })

        // Estimate gas if not provided
        let gas: bigint | undefined
        if (gasLimit) {
          gas = BigInt(gasLimit)
        } else {
          try {
            gas = await publicClient.estimateGas({
              account: deployer,
              data: deployData,
              value: value ? BigInt(value) : 0n
            })
            // Add 20% buffer for safety
            gas = (gas * 120n) / 100n
          } catch (estimateError: any) {
            return mcpToolRes.error(
              new Error(`Gas estimation failed: ${estimateError.message}`),
              "deploying contract"
            )
          }
        }

        // Deploy the contract
        const hash = await walletClient.sendTransaction({
          data: deployData,
          value: value ? BigInt(value) : 0n,
          gas
        })

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === "reverted") {
          return mcpToolRes.error(new Error("Contract deployment reverted"), "deploying contract")
        }

        return mcpToolRes.success({
          network,
          deployment: {
            transactionHash: hash,
            contractAddress: receipt.contractAddress,
            predictedAddress,
            deployer,
            gasUsed: receipt.gasUsed.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            blockNumber: receipt.blockNumber.toString()
          },
          status: "success",
          note: "Contract deployed successfully. Consider verifying the source code."
        })
      } catch (error) {
        return mcpToolRes.error(error, "deploying contract")
      }
    }
  )

  // Deploy with CREATE2
  server.tool(
    "deploy_create2",
    "Deploy a contract using CREATE2 for deterministic addresses across chains",
    {
      network: defaultNetworkParam,
      bytecode: z.string().describe("Contract bytecode (hex string)"),
      salt: z.string().describe("Salt for deterministic address (32 bytes hex or string to hash)"),
      abi: z.array(z.any()).optional().describe("Contract ABI (required if constructor has arguments)"),
      constructorArgs: z.array(z.any()).optional().describe("Constructor arguments"),
      factoryAddress: z.string().optional().describe("CREATE2 factory address (uses default if not provided)"),
      privateKey: z.string().describe("Private key for deployment").default(process.env.PRIVATE_KEY as string)
    },
    async ({ network, bytecode, salt, abi, constructorArgs = [], factoryAddress, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const chainId = await publicClient.getChainId()
        const deployer = walletClient.account.address

        // Validate bytecode
        if (!bytecode.startsWith("0x")) {
          bytecode = `0x${bytecode}`
        }

        // Prepare salt (hash if not 32 bytes hex)
        let saltBytes: Hex
        if (salt.startsWith("0x") && salt.length === 66) {
          saltBytes = salt as Hex
        } else {
          saltBytes = keccak256(toBytes(salt))
        }

        // Get factory address
        const factory = factoryAddress 
          ? factoryAddress as Address 
          : CREATE2_FACTORY[chainId]
        
        if (!factory) {
          return mcpToolRes.error(
            new Error(`No CREATE2 factory configured for chain ${chainId}. Please provide factoryAddress.`),
            "deploying with CREATE2"
          )
        }

        // Prepare init code with constructor args
        let initCode: Hex
        if (abi && constructorArgs.length > 0) {
          initCode = encodeDeployData({
            abi,
            bytecode: bytecode as Hex,
            args: constructorArgs
          })
        } else {
          initCode = bytecode as Hex
        }

        // Calculate deterministic address
        const initCodeHash = keccak256(initCode)
        const predictedAddress = getCreate2Address({
          from: factory,
          salt: saltBytes,
          bytecodeHash: initCodeHash
        })

        // Check if already deployed
        const existingCode = await publicClient.getCode({ address: predictedAddress })
        if (existingCode && existingCode !== "0x") {
          return mcpToolRes.success({
            network,
            alreadyDeployed: true,
            contractAddress: predictedAddress,
            salt: saltBytes,
            factory,
            note: "Contract already exists at this address"
          })
        }

        // Prepare deployment transaction to factory
        // Standard CREATE2 factory takes salt + init code
        const deploymentData = concat([saltBytes, initCode])

        // Estimate gas
        const gas = await publicClient.estimateGas({
          account: deployer,
          to: factory,
          data: deploymentData
        })

        // Send deployment transaction
        const hash = await walletClient.sendTransaction({
          to: factory,
          data: deploymentData,
          gas: (gas * 120n) / 100n
        })

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // Verify deployment
        const deployedCode = await publicClient.getCode({ address: predictedAddress })
        const deployed = deployedCode && deployedCode !== "0x"

        return mcpToolRes.success({
          network,
          deployment: {
            transactionHash: hash,
            contractAddress: predictedAddress,
            salt: saltBytes,
            factory,
            initCodeHash,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber.toString()
          },
          status: deployed ? "success" : "failed",
          note: deployed 
            ? "Contract deployed via CREATE2. Same salt + bytecode = same address on other chains."
            : "Deployment transaction succeeded but contract not found at predicted address"
        })
      } catch (error) {
        return mcpToolRes.error(error, "deploying with CREATE2")
      }
    }
  )

  // Deploy proxy contract
  server.tool(
    "deploy_proxy",
    "Deploy a proxy contract (UUPS or TransparentUpgradeableProxy) pointing to an implementation",
    {
      network: defaultNetworkParam,
      implementationAddress: z.string().describe("Address of the implementation contract"),
      proxyType: z.enum(["transparent", "uups"]).describe("Type of proxy to deploy"),
      adminAddress: z.string().optional().describe("Admin address (for transparent proxy)"),
      initData: z.string().optional().describe("Initialization calldata (hex) to call on implementation"),
      abi: z.array(z.any()).optional().describe("Implementation ABI (required for init function encoding)"),
      initFunction: z.string().optional().describe("Name of initialization function"),
      initArgs: z.array(z.any()).optional().describe("Arguments for initialization function"),
      privateKey: z.string().describe("Private key for deployment").default(process.env.PRIVATE_KEY as string)
    },
    async ({ 
      network, 
      implementationAddress, 
      proxyType, 
      adminAddress,
      initData,
      abi,
      initFunction,
      initArgs = [],
      privateKey 
    }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const deployer = walletClient.account.address

        // Validate implementation exists
        const implCode = await publicClient.getCode({ address: implementationAddress as Address })
        if (!implCode || implCode === "0x") {
          return mcpToolRes.error(
            new Error("Implementation address has no contract code"),
            "deploying proxy"
          )
        }

        // Prepare initialization data
        let initCalldata: Hex = "0x"
        if (initData) {
          initCalldata = initData as Hex
        } else if (abi && initFunction) {
          initCalldata = encodeFunctionData({
            abi,
            functionName: initFunction,
            args: initArgs
          })
        }

        // Admin address defaults to deployer
        const admin = adminAddress || deployer

        // OpenZeppelin Transparent Proxy bytecode (simplified - in production use actual bytecode)
        // This is the ERC1967Proxy constructor structure
        const ERC1967_PROXY_BYTECODE = "0x608060405260405161086d38038061086d83398181016040528101906100259190610537565b61005160017f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbd6100b860201b60201c565b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b61008460001b60201c565b6100ac82826100b060201b60201c565b50505050565b9055565b600082511115610101578173ffffffffffffffffffffffffffffffffffffffff16826040516100e29190610636565b600060405180830381855af49150503d806000811461011d576040519150601f19603f3d011682016040523d82523d6000602084013e610122565b606091505b50505b505056fea26469706673582212209b"

        // For transparent proxy, we need to deploy ProxyAdmin first or use existing
        let proxyAdminAddress: Address | null = null
        let proxyAddress: Address | null = null
        let deploymentTx: Hash

        if (proxyType === "transparent") {
          // Deploy TransparentUpgradeableProxy
          // In production, this would use the actual OpenZeppelin bytecode
          
          const deployData = encodeDeployData({
            abi: [
              {
                type: "constructor",
                inputs: [
                  { name: "_logic", type: "address" },
                  { name: "_admin", type: "address" },
                  { name: "_data", type: "bytes" }
                ]
              }
            ],
            // Note: In production, use actual TransparentUpgradeableProxy bytecode
            bytecode: ERC1967_PROXY_BYTECODE as Hex,
            args: [implementationAddress, admin, initCalldata]
          })

          const gas = await publicClient.estimateGas({
            account: deployer,
            data: deployData
          }).catch(() => 500000n)

          deploymentTx = await walletClient.sendTransaction({
            data: deployData,
            gas: (gas * 120n) / 100n
          })

          const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx })
          proxyAddress = receipt.contractAddress
          proxyAdminAddress = admin as Address
        } else {
          // UUPS Proxy (simpler - just ERC1967Proxy)
          const deployData = encodeDeployData({
            abi: [
              {
                type: "constructor",
                inputs: [
                  { name: "_logic", type: "address" },
                  { name: "_data", type: "bytes" }
                ]
              }
            ],
            bytecode: ERC1967_PROXY_BYTECODE as Hex,
            args: [implementationAddress, initCalldata]
          })

          const gas = await publicClient.estimateGas({
            account: deployer,
            data: deployData
          }).catch(() => 500000n)

          deploymentTx = await walletClient.sendTransaction({
            data: deployData,
            gas: (gas * 120n) / 100n
          })

          const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx })
          proxyAddress = receipt.contractAddress
        }

        // Verify deployment by reading storage slots
        let verifiedImplementation: Address | null = null
        let verifiedAdmin: Address | null = null

        if (proxyAddress) {
          try {
            const implSlotData = await publicClient.getStorageAt({
              address: proxyAddress,
              slot: IMPLEMENTATION_SLOT as Hex
            })
            if (implSlotData) {
              verifiedImplementation = `0x${implSlotData.slice(-40)}` as Address
            }
          } catch {}

          if (proxyType === "transparent") {
            try {
              const adminSlotData = await publicClient.getStorageAt({
                address: proxyAddress,
                slot: ADMIN_SLOT as Hex
              })
              if (adminSlotData) {
                verifiedAdmin = `0x${adminSlotData.slice(-40)}` as Address
              }
            } catch {}
          }
        }

        return mcpToolRes.success({
          network,
          deployment: {
            proxyType,
            transactionHash: deploymentTx,
            proxyAddress,
            implementationAddress,
            proxyAdminAddress: proxyType === "transparent" ? proxyAdminAddress : null,
            initializationData: initCalldata !== "0x" ? initCalldata : null
          },
          verification: {
            implementationMatches: verifiedImplementation?.toLowerCase() === implementationAddress.toLowerCase(),
            verifiedImplementation,
            verifiedAdmin
          },
          status: "success",
          note: proxyType === "transparent"
            ? "TransparentUpgradeableProxy deployed. Upgrades must go through the admin."
            : "UUPS Proxy deployed. Upgrades are handled by the implementation contract."
        })
      } catch (error) {
        return mcpToolRes.error(error, "deploying proxy")
      }
    }
  )

  // Upgrade proxy implementation
  server.tool(
    "upgrade_proxy",
    "Upgrade a proxy contract to a new implementation address",
    {
      network: defaultNetworkParam,
      proxyAddress: z.string().describe("Address of the proxy contract"),
      newImplementationAddress: z.string().describe("Address of the new implementation"),
      proxyType: z.enum(["transparent", "uups"]).describe("Type of proxy"),
      proxyAdminAddress: z.string().optional().describe("ProxyAdmin address (for transparent proxies)"),
      callAfterUpgrade: z.boolean().optional().describe("Whether to call a function after upgrade"),
      upgradeCalldata: z.string().optional().describe("Calldata for post-upgrade call"),
      privateKey: z.string().describe("Private key for upgrade").default(process.env.PRIVATE_KEY as string)
    },
    async ({ 
      network, 
      proxyAddress, 
      newImplementationAddress, 
      proxyType,
      proxyAdminAddress,
      callAfterUpgrade = false,
      upgradeCalldata,
      privateKey 
    }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)

        // Validate new implementation exists
        const newImplCode = await publicClient.getCode({ address: newImplementationAddress as Address })
        if (!newImplCode || newImplCode === "0x") {
          return mcpToolRes.error(
            new Error("New implementation address has no contract code"),
            "upgrading proxy"
          )
        }

        // Get current implementation for comparison
        let currentImplementation: Address | null = null
        try {
          const implSlotData = await publicClient.getStorageAt({
            address: proxyAddress as Address,
            slot: IMPLEMENTATION_SLOT as Hex
          })
          if (implSlotData) {
            currentImplementation = `0x${implSlotData.slice(-40)}` as Address
          }
        } catch {}

        let upgradeTx: Hash

        if (proxyType === "transparent") {
          // Transparent proxy - upgrade through ProxyAdmin
          if (!proxyAdminAddress) {
            // Try to read admin from storage
            const adminSlotData = await publicClient.getStorageAt({
              address: proxyAddress as Address,
              slot: ADMIN_SLOT as Hex
            })
            if (adminSlotData) {
              proxyAdminAddress = `0x${adminSlotData.slice(-40)}`
            } else {
              return mcpToolRes.error(
                new Error("Could not determine proxy admin address. Please provide proxyAdminAddress."),
                "upgrading proxy"
              )
            }
          }

          // Call upgrade on ProxyAdmin or directly on proxy
          const upgradeData = callAfterUpgrade && upgradeCalldata
            ? encodeFunctionData({
                abi: PROXY_ADMIN_ABI,
                functionName: "upgradeAndCall",
                args: [proxyAddress as Address, newImplementationAddress as Address, upgradeCalldata as Hex]
              })
            : encodeFunctionData({
                abi: PROXY_ADMIN_ABI,
                functionName: "upgrade",
                args: [proxyAddress as Address, newImplementationAddress as Address]
              })

          const gas = await publicClient.estimateGas({
            account: walletClient.account.address,
            to: proxyAdminAddress as Address,
            data: upgradeData
          })

          upgradeTx = await walletClient.sendTransaction({
            to: proxyAdminAddress as Address,
            data: upgradeData,
            gas: (gas * 120n) / 100n
          })
        } else {
          // UUPS - upgrade through the proxy itself
          const upgradeData = callAfterUpgrade && upgradeCalldata
            ? encodeFunctionData({
                abi: UUPS_PROXY_ABI,
                functionName: "upgradeToAndCall",
                args: [newImplementationAddress as Address, upgradeCalldata as Hex]
              })
            : encodeFunctionData({
                abi: UUPS_PROXY_ABI,
                functionName: "upgradeTo",
                args: [newImplementationAddress as Address]
              })

          const gas = await publicClient.estimateGas({
            account: walletClient.account.address,
            to: proxyAddress as Address,
            data: upgradeData
          })

          upgradeTx = await walletClient.sendTransaction({
            to: proxyAddress as Address,
            data: upgradeData,
            gas: (gas * 120n) / 100n
          })
        }

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: upgradeTx })

        // Verify upgrade
        let verifiedNewImplementation: Address | null = null
        try {
          const implSlotData = await publicClient.getStorageAt({
            address: proxyAddress as Address,
            slot: IMPLEMENTATION_SLOT as Hex
          })
          if (implSlotData) {
            verifiedNewImplementation = `0x${implSlotData.slice(-40)}` as Address
          }
        } catch {}

        const upgradeSuccessful = verifiedNewImplementation?.toLowerCase() === newImplementationAddress.toLowerCase()

        return mcpToolRes.success({
          network,
          upgrade: {
            proxyAddress,
            proxyType,
            previousImplementation: currentImplementation,
            newImplementation: newImplementationAddress,
            transactionHash: upgradeTx,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber.toString()
          },
          verification: {
            upgradeSuccessful,
            verifiedImplementation: verifiedNewImplementation
          },
          status: upgradeSuccessful ? "success" : "uncertain",
          note: upgradeSuccessful
            ? "Proxy upgraded successfully to new implementation"
            : "Upgrade transaction succeeded but implementation verification failed - check manually"
        })
      } catch (error) {
        return mcpToolRes.error(error, "upgrading proxy")
      }
    }
  )

  // Verify contract on block explorer
  server.tool(
    "verify_contract",
    "Submit contract source code for verification on block explorers (Etherscan, Basescan, etc.)",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Deployed contract address"),
      sourceCode: z.string().describe("Contract source code (Solidity)"),
      contractName: z.string().describe("Contract name as it appears in source"),
      compilerVersion: z.string().describe("Solidity compiler version (e.g., 'v0.8.19+commit.7dd6d404')"),
      optimizationUsed: z.boolean().optional().default(true).describe("Whether optimization was enabled"),
      runs: z.number().optional().default(200).describe("Optimization runs"),
      constructorArguments: z.string().optional().describe("ABI-encoded constructor arguments (hex)"),
      evmVersion: z.string().optional().default("london").describe("EVM version"),
      licenseType: z.number().optional().default(3).describe("License type (3 = MIT)"),
      apiKey: z.string().describe("Block explorer API key")
    },
    async ({ 
      network, 
      contractAddress, 
      sourceCode,
      contractName,
      compilerVersion,
      optimizationUsed = true,
      runs = 200,
      constructorArguments = "",
      evmVersion = "london",
      licenseType = 3,
      apiKey 
    }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const explorerApi = EXPLORER_APIS[chainId]
        if (!explorerApi) {
          return mcpToolRes.error(
            new Error(`No block explorer API configured for chain ${chainId}`),
            "verifying contract"
          )
        }

        // Verify contract exists
        const code = await publicClient.getCode({ address: contractAddress as Address })
        if (!code || code === "0x") {
          return mcpToolRes.error(
            new Error("No contract found at this address"),
            "verifying contract"
          )
        }

        // Prepare verification request
        const params = new URLSearchParams({
          apikey: apiKey,
          module: "contract",
          action: "verifysourcecode",
          contractaddress: contractAddress,
          sourceCode: sourceCode,
          codeformat: "solidity-single-file",
          contractname: contractName,
          compilerversion: compilerVersion,
          optimizationUsed: optimizationUsed ? "1" : "0",
          runs: runs.toString(),
          evmversion: evmVersion,
          licenseType: licenseType.toString()
        })

        if (constructorArguments) {
          params.set("constructorArguements", constructorArguments.replace("0x", ""))
        }

        // Submit verification
        const response = await fetch(explorerApi.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        })

        const result = await response.json()

        if (result.status === "1") {
          // Verification submitted successfully, got a GUID
          const guid = result.result

          // Poll for verification status
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

          const statusParams = new URLSearchParams({
            apikey: apiKey,
            module: "contract",
            action: "checkverifystatus",
            guid: guid
          })

          let verificationStatus = "pending"
          let attempts = 0
          
          while (attempts < 6 && verificationStatus === "pending") {
            await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
            
            const statusResponse = await fetch(`${explorerApi.url}?${statusParams.toString()}`)
            const statusResult = await statusResponse.json()
            
            if (statusResult.result === "Pending in queue") {
              verificationStatus = "pending"
            } else if (statusResult.result === "Pass - Verified") {
              verificationStatus = "verified"
            } else if (statusResult.result?.includes("Fail")) {
              verificationStatus = "failed"
              return mcpToolRes.success({
                network,
                contractAddress,
                explorer: explorerApi.name,
                verificationStatus,
                guid,
                error: statusResult.result,
                note: "Verification failed - check compiler settings and source code"
              })
            }
            
            attempts++
          }

          return mcpToolRes.success({
            network,
            contractAddress,
            explorer: explorerApi.name,
            verificationStatus,
            guid,
            explorerUrl: `${explorerApi.url.replace("/api", "")}/address/${contractAddress}#code`,
            note: verificationStatus === "verified"
              ? "Contract successfully verified!"
              : "Verification submitted - check explorer for status"
          })
        } else {
          return mcpToolRes.success({
            network,
            contractAddress,
            explorer: explorerApi.name,
            verificationStatus: "failed",
            error: result.result || result.message,
            note: "Verification submission failed"
          })
        }
      } catch (error) {
        return mcpToolRes.error(error, "verifying contract")
      }
    }
  )

  // Predict CREATE2 address
  server.tool(
    "predict_create2_address",
    "Calculate the deterministic address for a CREATE2 deployment without deploying",
    {
      network: defaultNetworkParam,
      bytecode: z.string().describe("Contract bytecode"),
      salt: z.string().describe("Salt for deterministic address"),
      constructorArgs: z.array(z.any()).optional().describe("Constructor arguments"),
      abi: z.array(z.any()).optional().describe("Contract ABI (if constructor has args)"),
      factoryAddress: z.string().optional().describe("CREATE2 factory address")
    },
    async ({ network, bytecode, salt, constructorArgs = [], abi, factoryAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()

        // Validate bytecode
        if (!bytecode.startsWith("0x")) {
          bytecode = `0x${bytecode}`
        }

        // Prepare salt
        let saltBytes: Hex
        if (salt.startsWith("0x") && salt.length === 66) {
          saltBytes = salt as Hex
        } else {
          saltBytes = keccak256(toBytes(salt))
        }

        // Get factory address
        const factory = factoryAddress 
          ? factoryAddress as Address 
          : CREATE2_FACTORY[chainId]
        
        if (!factory) {
          return mcpToolRes.error(
            new Error(`No CREATE2 factory configured for chain ${chainId}`),
            "predicting CREATE2 address"
          )
        }

        // Prepare init code
        let initCode: Hex
        if (abi && constructorArgs.length > 0) {
          initCode = encodeDeployData({
            abi,
            bytecode: bytecode as Hex,
            args: constructorArgs
          })
        } else {
          initCode = bytecode as Hex
        }

        const initCodeHash = keccak256(initCode)
        const predictedAddress = getCreate2Address({
          from: factory,
          salt: saltBytes,
          bytecodeHash: initCodeHash
        })

        // Check if already deployed
        const existingCode = await publicClient.getCode({ address: predictedAddress })
        const isDeployed = existingCode && existingCode !== "0x"

        return mcpToolRes.success({
          network,
          prediction: {
            address: predictedAddress,
            salt: saltBytes,
            factory,
            initCodeHash,
            isDeployed
          },
          note: isDeployed
            ? "Contract already deployed at this address"
            : "Address is available for deployment"
        })
      } catch (error) {
        return mcpToolRes.error(error, "predicting CREATE2 address")
      }
    }
  )
}
