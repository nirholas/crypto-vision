/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { formatEther, formatUnits, getContract, type Address } from "viem"

import { ERC20_ABI } from "./abi/erc20.js"
import { getPublicClient } from "./clients.js"
import { resolveAddress } from "./ens.js"

/**
 * Get the ETH balance for an address
 * @param addressOrEns Ethereum address or ENS name
 * @param network Network name or chain ID
 * @returns Balance in wei and ether
 */
export async function getNativeBalance(
  addressOrEns: string,
  network = "bsc"
): Promise<{
  raw: bigint
  formatted: string
  network: string
  symbol: string
  decimals: number
}> {
  // Resolve ENS name to address if needed
  const address = await resolveAddress(addressOrEns, network)

  const client = getPublicClient(network)
  const balance = await client.getBalance({ address })
  const nativeCurrency = client.chain?.nativeCurrency

  return {
    raw: balance,
    formatted: formatEther(balance),
    network,
    symbol: nativeCurrency?.symbol ?? "Unknown",
    decimals: nativeCurrency?.decimals ?? 18
  }
}

/**
 * Get the balance of an ERC20 token for an address
 * @param tokenAddressOrEns Token contract address or ENS name
 * @param ownerAddressOrEns Owner address or ENS name
 * @param network Network name or chain ID
 * @returns Token balance with formatting information
 */
export async function getERC20Balance(
  tokenAddressOrEns: string,
  ownerAddressOrEns: string,
  network = "ethereum"
): Promise<{
  raw: bigint
  formatted: string
  symbol: string
  decimals: number
  network: string
  tokenAddress: Address
  ownerAddress: Address
}> {
  // Resolve ENS names to addresses if needed
  const tokenAddress = await resolveAddress(tokenAddressOrEns, network)
  const ownerAddress = await resolveAddress(ownerAddressOrEns, network)

  const publicClient = getPublicClient(network)

  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  })

  const [balance, symbol, decimals] = await Promise.all([
    contract.read.balanceOf([ownerAddress]) as Promise<bigint>,
    contract.read.symbol() as Promise<string>,
    contract.read.decimals() as Promise<number>
  ])

  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
    symbol,
    decimals,
    network,
    tokenAddress,
    ownerAddress
  }
}
