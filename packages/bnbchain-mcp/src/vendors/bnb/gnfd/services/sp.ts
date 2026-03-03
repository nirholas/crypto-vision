/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { getClient } from "./client"

export const getSps = async (network: "testnet" | "mainnet") => {
  const client = getClient(network)
  const sps = await client.sp.getStorageProviders()

  return sps
}

export const getAllSps = async (network: "testnet" | "mainnet") => {
  const sps = await getSps(network)
  return sps.map((sp) => {
    return {
      address: sp.operatorAddress,
      endpoint: sp.endpoint,
      name: sp.description?.moniker,
      status: sp.status
    }
  })
}

export const selectSp = async (network: "testnet" | "mainnet") => {
  const finalSps = await getSps(network)
  if (!finalSps?.length) {
    throw new Error("No storage providers available")
  }

  let allActiveSps = finalSps.filter((sp) => sp.status === 0) // 0 is STATUS_IN_SERVICE
  if (network === "testnet") {
    allActiveSps = allActiveSps.filter(
      (sp) =>
        sp.endpoint.includes("nodereal") || sp.endpoint.includes("bnbchain")
    )
  }

  const selectIndex = Math.floor(Math.random() * allActiveSps.length)
  const selectedSp = allActiveSps[selectIndex]
  if (!selectedSp) {
    throw new Error("Failed to select storage provider")
  }

  const secondarySpAddresses = [
    ...finalSps.slice(0, selectIndex),
    ...finalSps.slice(selectIndex + 1)
  ].map((item) => item.operatorAddress)

  const selectSpInfo = {
    id: selectedSp.id,
    endpoint: selectedSp.endpoint,
    primarySpAddress: selectedSp.operatorAddress,
    sealAddress: selectedSp.sealAddress,
    secondarySpAddresses
  }

  return selectSpInfo
}
