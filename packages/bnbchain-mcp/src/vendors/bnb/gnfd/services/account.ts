/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import Logger from "@/utils/logger"
import { getClient } from "./client"

export const getAddressFromPrivateKey = (privateKey: Hex) => {
  const account = privateKeyToAccount(privateKey)

  return account.address
}

export const getAccount = async (
  network: "testnet" | "mainnet",
  privateKey: Hex
) => {
  const client = getClient(network)
  const account = await client.account.getAccount(
    getAddressFromPrivateKey(privateKey)
  )
  return account
}

export const getAccountBalance = async (
  network: "testnet" | "mainnet",
  {
    privateKey,
    address
  }: {
    privateKey?: Hex
    address?: string
  }
) => {
  const client = getClient(network)
  const account = await client.account.getAccountBalance({
    address: address || getAddressFromPrivateKey(privateKey as Hex),
    denom: "BNB"
  })
  return account.balance
}

export const getPaymentAccounts = async (
  network: "testnet" | "mainnet",
  {
    address,
    privateKey
  }: {
    address?: string
    privateKey?: Hex
  }
) => {
  const client = getClient(network)
  return (
    (
      await client.payment.getPaymentAccountsByOwner({
        owner: address || getAddressFromPrivateKey(privateKey as Hex)
      })
    ).paymentAccounts || []
  )
}
