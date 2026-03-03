/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { Client } from "@bnb-chain/greenfield-js-sdk"

import { MAINNET, TESTNET } from "../constants"

const getRpcUrl = (network: "testnet" | "mainnet") => {
  return network === "testnet" ? TESTNET.rpcUrl : MAINNET.rpcUrl
}

const getChainId = (network: "testnet" | "mainnet") => {
  return network === "testnet" ? TESTNET.chainid : MAINNET.chainid
}

const clientMap = new Map<string, Client>()

export const getClient = (network: "testnet" | "mainnet") => {
  if (!clientMap.has(network)) {
    clientMap.set(
      network,
      Client.create(getRpcUrl(network), getChainId(network).toString())
    )
  }
  return clientMap.get(network) as Client
}
