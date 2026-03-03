/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { formatUnits, getContract, parseUnits, type Address } from "viem"

import Logger from "@/utils/logger.js"
import { ERC20_ABI, ERC20_BYTECODE } from "./abi/erc20.js"
import { ERC721_ABI } from "./abi/erc721.js"
import { ERC1155_ABI } from "./abi/erc1155.js"
import { getPublicClient, getWalletClient } from "./clients.js"
import { isContract } from "./contracts.js"

/**
 * Get ERC20 token information
 */
export async function getERC20TokenInfo(
  tokenAddress: Address,
  network: string = "ethereum"
): Promise<{
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  formattedTotalSupply: string
}> {
  const publicClient = getPublicClient(network)
  const isContractAddr = await isContract(tokenAddress, network)
  if (!isContractAddr) {
    throw new Error("Token address is not a contract")
  }

  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  })

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.read.name() as Promise<string>,
    contract.read.symbol() as Promise<string>,
    contract.read.decimals() as Promise<number>,
    contract.read.totalSupply() as Promise<bigint>
  ])

  return {
    name,
    symbol,
    decimals,
    totalSupply,
    formattedTotalSupply: formatUnits(totalSupply, decimals)
  }
}

/**
 * Get ERC721 token metadata
 */
export async function getERC721TokenMetadata(
  tokenAddress: Address,
  tokenId: bigint,
  network: string = "ethereum"
): Promise<{
  id: bigint
  name: string
  symbol: string
  tokenURI: string
  owner: Address
  totalSupply: bigint
  network: string
  contractAddress: Address
}> {
  const publicClient = getPublicClient(network)
  const isContractAddr = await isContract(tokenAddress, network)
  if (!isContractAddr) {
    throw new Error("Token address is not a contract")
  }

  const contract = getContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    client: publicClient
  })

  const [name, symbol, tokenURI, owner, totalSupply] = await Promise.all([
    contract.read.name() as Promise<string>,
    contract.read.symbol() as Promise<string>,
    contract.read.tokenURI([tokenId]) as Promise<string>,
    contract.read.ownerOf([tokenId]) as Promise<Address>,
    contract.read.totalSupply() as Promise<bigint>
  ])

  return {
    id: tokenId,
    name,
    symbol,
    tokenURI,
    owner,
    totalSupply,
    network,
    contractAddress: tokenAddress
  }
}

/**
 * Get ERC1155 token URI
 */
export async function getERC1155TokenMetadata(
  tokenAddress: Address,
  tokenId: bigint,
  network: string = "ethereum"
): Promise<{
  id: bigint
  name: string
  tokenURI: string
  network: string
  contractAddress: Address
}> {
  const publicClient = getPublicClient(network)
  const isContractAddr = await isContract(tokenAddress, network)
  if (!isContractAddr) {
    throw new Error("Token address is not a contract")
  }

  const contract = getContract({
    address: tokenAddress,
    abi: ERC1155_ABI,
    client: publicClient
  })

  const [name, uri] = await Promise.all([
    contract.read.name() as Promise<string>,
    contract.read.uri([tokenId]) as Promise<string>
  ])

  return {
    id: tokenId,
    name,
    tokenURI: uri,
    network,
    contractAddress: tokenAddress
  }
}

/**
 * Create a new ERC20 token
 * @param name The name of the token
 * @param symbol The symbol/ticker of the token
 * @param privateKey The private key of the deployer account
 * @param network The network to deploy on (default: "bsc")
 * @param totalSupply The total supply of tokens to mint (default: "1000000000")
 * @returns {Promise<{hash: string, name: string, symbol: string, owner: string, totalSupply: bigint}>} The transaction hash, token details and owner address
 */
export const createERC20Token = async ({
  name,
  symbol,
  privateKey,
  totalSupply = "1000000000", // default 1 billion
  network = "bsc"
}: {
  name: string
  symbol: string
  privateKey: `0x${string}`
  network: string
  totalSupply?: string
}) => {
  const client = getWalletClient(privateKey, network)
  const supply = BigInt(totalSupply)
  const hash = await client.deployContract({
    abi: ERC20_ABI,
    bytecode: ERC20_BYTECODE,
    args: [name, symbol, supply],
    account: client.account!,
    chain: client.chain
  })

  Logger.info(`Deployed new ERC20 token (${name} - ${symbol}): ${hash}`)
  return {
    hash,
    name,
    symbol,
    totalSupply: supply,
    owner: client.account!.address
  }
}
