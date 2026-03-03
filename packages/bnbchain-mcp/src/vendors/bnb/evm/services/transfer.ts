/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import {
  getContract,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
  type Hex
} from "viem"

import { ERC20_ABI } from "./abi/erc20.js"
import { ERC721_ABI } from "./abi/erc721.js"
import { ERC1155_ABI } from "./abi/erc1155.js"
import { getPublicClient, getWalletClient } from "./clients.js"
import { resolveAddress } from "./ens.js"

/**
 * Transfer ETH to an address
 * @param privateKey Sender's private key
 * @param toAddressOrEns Recipient address or ENS name
 * @param amount Amount to send in ETH
 * @param network Network name or chain ID
 * @returns Transaction hash
 */
export async function transferETH(
  privateKey: string | Hex,
  toAddressOrEns: string,
  amount: string, // in ether
  network = "ethereum"
): Promise<Hash> {
  // Resolve ENS name to address if needed
  const toAddress = await resolveAddress(toAddressOrEns, network)

  // Ensure the private key has 0x prefix
  const formattedKey =
    typeof privateKey === "string" && !privateKey.startsWith("0x")
      ? (`0x${privateKey}` as Hex)
      : (privateKey as Hex)

  const client = getWalletClient(formattedKey, network)
  const amountWei = parseEther(amount)

  return client.sendTransaction({
    to: toAddress,
    value: amountWei,
    account: client.account!,
    chain: client.chain
  })
}

/**
 * Transfer ERC20 tokens to an address
 * @param tokenAddressOrEns Token contract address or ENS name
 * @param toAddressOrEns Recipient address or ENS name
 * @param amount Amount to send (in token units)
 * @param privateKey Sender's private key
 * @param network Network name or chain ID
 * @returns Transaction details
 */
export async function transferERC20(
  tokenAddressOrEns: string,
  toAddressOrEns: string,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = "ethereum"
): Promise<{
  txHash: Hash
  amount: {
    raw: bigint
    formatted: string
  }
  token: {
    symbol: string
    decimals: number
  }
}> {
  // Resolve ENS names to addresses if needed
  const tokenAddress = (await resolveAddress(
    tokenAddressOrEns,
    network
  )) as Address
  const toAddress = (await resolveAddress(toAddressOrEns, network)) as Address

  // Ensure the private key has 0x prefix
  const formattedKey =
    typeof privateKey === "string" && !privateKey.startsWith("0x")
      ? (`0x${privateKey}` as `0x${string}`)
      : (privateKey as `0x${string}`)

  // Get token details
  const publicClient = getPublicClient(network)
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  })

  // Get token decimals and symbol
  const decimals = (await contract.read.decimals()) as number
  const symbol = (await contract.read.symbol()) as string

  // Parse the amount with the correct number of decimals
  const rawAmount = parseUnits(amount, decimals)

  // Create wallet client for sending the transaction
  const walletClient = getWalletClient(formattedKey, network)

  // Send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [toAddress, rawAmount],
    account: walletClient.account!,
    chain: walletClient.chain
  })

  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  }
}

/**
 * Approve ERC20 token spending
 * @param tokenAddressOrEns Token contract address or ENS name
 * @param spenderAddressOrEns Spender address or ENS name
 * @param amount Amount to approve (in token units)
 * @param privateKey Owner's private key
 * @param network Network name or chain ID
 * @returns Transaction details
 */
export async function approveERC20(
  tokenAddressOrEns: string,
  spenderAddressOrEns: string,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = "ethereum"
): Promise<{
  txHash: Hash
  amount: {
    raw: bigint
    formatted: string
  }
  token: {
    symbol: string
    decimals: number
  }
}> {
  // Resolve ENS names to addresses if needed
  const tokenAddress = (await resolveAddress(
    tokenAddressOrEns,
    network
  )) as Address
  const spenderAddress = (await resolveAddress(
    spenderAddressOrEns,
    network
  )) as Address

  // Ensure the private key has 0x prefix
  const formattedKey =
    typeof privateKey === "string" && !privateKey.startsWith("0x")
      ? (`0x${privateKey}` as `0x${string}`)
      : (privateKey as `0x${string}`)

  // Get token details
  const publicClient = getPublicClient(network)
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  })

  // Get token decimals and symbol
  const decimals = (await contract.read.decimals()) as number
  const symbol = (await contract.read.symbol()) as string

  // Parse the amount with the correct number of decimals
  const rawAmount = parseUnits(amount, decimals)

  // Create wallet client for sending the transaction
  const walletClient = getWalletClient(formattedKey, network)

  // Send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spenderAddress, rawAmount],
    account: walletClient.account!,
    chain: walletClient.chain
  })

  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  }
}

/**
 * Transfer an NFT to an address
 * @param tokenAddressOrEns NFT contract address or ENS name
 * @param toAddressOrEns Recipient address or ENS name
 * @param tokenId Token ID to transfer
 * @param privateKey Owner's private key
 * @param network Network name or chain ID
 * @returns Transaction details
 */
export async function transferERC721(
  tokenAddressOrEns: string,
  toAddressOrEns: string,
  tokenId: bigint,
  privateKey: string | `0x${string}`,
  network: string = "ethereum"
): Promise<{
  txHash: Hash
  tokenId: string
  token: {
    name: string
    symbol: string
  }
}> {
  // Resolve ENS names to addresses if needed
  const tokenAddress = (await resolveAddress(
    tokenAddressOrEns,
    network
  )) as Address
  const toAddress = (await resolveAddress(toAddressOrEns, network)) as Address

  // Ensure the private key has 0x prefix
  const formattedKey =
    typeof privateKey === "string" && !privateKey.startsWith("0x")
      ? (`0x${privateKey}` as `0x${string}`)
      : (privateKey as `0x${string}`)

  // Get token details
  const publicClient = getPublicClient(network)
  const contract = getContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    client: publicClient
  })

  // Get token name and symbol
  const name = (await contract.read.name()) as string
  const symbol = (await contract.read.symbol()) as string

  // Create wallet client for sending the transaction
  const walletClient = getWalletClient(formattedKey, network)

  // Send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    functionName: "transferFrom",
    args: [walletClient.account!.address, toAddress, tokenId],
    account: walletClient.account!,
    chain: walletClient.chain
  })

  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    token: {
      name,
      symbol
    }
  }
}

/**
 * Transfer ERC1155 tokens to an address
 * @param tokenAddressOrEns Token contract address or ENS name
 * @param toAddressOrEns Recipient address or ENS name
 * @param tokenId Token ID to transfer
 * @param amount Amount of tokens to transfer
 * @param privateKey Owner's private key
 * @param network Network name or chain ID
 * @returns Transaction details
 */
export async function transferERC1155(
  tokenAddressOrEns: string,
  toAddressOrEns: string,
  tokenId: bigint,
  amount: string,
  privateKey: string | `0x${string}`,
  network: string = "ethereum"
): Promise<{
  txHash: Hash
  tokenId: string
  amount: string
}> {
  // Resolve ENS names to addresses if needed
  const tokenAddress = (await resolveAddress(
    tokenAddressOrEns,
    network
  )) as Address
  const toAddress = (await resolveAddress(toAddressOrEns, network)) as Address

  // Ensure the private key has 0x prefix
  const formattedKey =
    typeof privateKey === "string" && !privateKey.startsWith("0x")
      ? (`0x${privateKey}` as `0x${string}`)
      : (privateKey as `0x${string}`)

  // Create wallet client for sending the transaction
  const walletClient = getWalletClient(formattedKey, network)

  // Send the transaction
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC1155_ABI,
    functionName: "safeTransferFrom",
    args: [
      walletClient.account!.address,
      toAddress,
      tokenId,
      BigInt(amount),
      "0x" as `0x${string}`
    ],
    account: walletClient.account!,
    chain: walletClient.chain
  })

  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    amount
  }
}
