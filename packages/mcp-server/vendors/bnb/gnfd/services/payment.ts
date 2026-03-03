/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { StreamAccountStatus } from "@bnb-chain/greenfield-cosmos-types/greenfield/payment/stream_record"
import { Long } from "@bnb-chain/greenfield-js-sdk"
import { Hex, parseEther } from "viem"

import { selectSp } from "@/gnfd/services/sp"
import { ApiResponse, response } from "../util"
import { getAccount } from "./account"
import { getClient } from "./client"
import { executeTransaction } from "./common"

type StoreFeeConfig = {
  readPrice: string
  primarySpStorePrice: string
  secondarySpStorePrice: string
  validatorTaxRate: string
  minChargeSize: number
  redundantDataChunkNum: number
  redundantParityChunkNum: number
  reserveTime: string
}
/**
 * Creates a payment account for the specified address
 * @param privateKey The private key for signing the transaction
 * @returns Transaction hash
 */
export const createPaymentAccount = async (
  network: "testnet" | "mainnet",
  privateKey: Hex
): Promise<ApiResponse<{ txHash: string }>> => {
  try {
    const client = getClient(network)
    const account = await getAccount(network, privateKey)
    const createPaymentAccountTx = await client.account.createPaymentAccount({
      creator: account.address
    })

    const tx = await executeTransaction<{ txHash: string }>(
      createPaymentAccountTx,
      account,
      privateKey,
      "Create payment account",
      account.address
    )

    return tx
  } catch (error: any) {
    return response.fail(`Failed to create payment account: ${error.message}`)
  }
}

/**
 * Deposits funds into a payment account
 * @param to The payment account address to deposit to
 * @param amount The amount to deposit (in BNB)
 * @param privateKey The private key for signing the transaction
 * @returns Transaction hash
 */
export const depositToPaymentAccount = async (
  network: "testnet" | "mainnet",
  {
    to,
    amount,
    privateKey
  }: {
    to: string
    amount: string
    privateKey: Hex
  }
): Promise<ApiResponse<void>> => {
  try {
    const client = getClient(network)
    const account = await getAccount(network, privateKey)
    const depositTx = await client.payment.deposit({
      creator: account.address,
      to,
      amount: parseEther(amount).toString()
    })

    const tx = await executeTransaction<void>(
      depositTx,
      account,
      privateKey,
      "Deposit funds",
      `Deposit ${amount} BNB to ${to}`
    )

    return tx
  } catch (error: any) {
    return response.fail(`Failed to deposit funds: ${error.message}`)
  }
}

/**
 * Withdraws funds from a payment account
 * @param from The payment account to withdraw from
 * @param amount The amount to withdraw (in BNB)
 * @param privateKey The private key for signing the transaction
 * @returns Transaction hash
 */
export const withdrawFromPaymentAccount = async (
  network: "testnet" | "mainnet",
  {
    from,
    amount,
    privateKey
  }: {
    from: string
    amount: string
    privateKey: Hex
  }
): Promise<ApiResponse<void>> => {
  try {
    const client = getClient(network)
    const account = await getAccount(network, privateKey)
    const withdrawTx = await client.payment.withdraw({
      creator: account.address,
      from,
      amount: parseEther(amount).toString()
    })

    const tx = await executeTransaction<void>(
      withdrawTx,
      account,
      privateKey,
      "Withdraw funds",
      `Withdraw ${amount} BNB from ${from}`
    )

    return tx
  } catch (error: any) {
    return response.fail(`Failed to withdraw funds: ${error.message}`)
  }
}

/**
 * Disables refund for a payment account
 * @warning ⚠️ CAUTION: This action is IRREVERSIBLE. Once disabled, ALL transfers to this payment account will become NON-REFUNDABLE.
 * @param address The payment account address to disable refund for
 * @param privateKey The private key for signing the transaction
 * @returns Transaction hash
 */
export const disableRefundForPaymentAccount = async (
  network: "testnet" | "mainnet",
  {
    address,
    privateKey
  }: {
    address: string
    privateKey: Hex
  }
): Promise<ApiResponse<void>> => {
  try {
    const client = getClient(network)
    const account = await getAccount(network, privateKey)
    const disableRefundTx = await client.payment.disableRefund({
      owner: account.address,
      addr: address
    })

    const tx = await executeTransaction<void>(
      disableRefundTx,
      account,
      privateKey,
      "Disable refund",
      `Disable refund for ${address}`
    )

    return tx
  } catch (error: any) {
    return response.fail(`Failed to disable refund: ${error.message}`)
  }
}

/**
 * Get a payment account info in Greenfield
 * @param network The network to use
 * @param paymentAddress The payment account address
 * @returns The payment account info
 */
export const getPaymentAccountInfo = async (
  network: "testnet" | "mainnet",
  paymentAddress: string
) => {
  try {
    const client = getClient(network)
    const account = await client.payment.paymentAccount({
      addr: paymentAddress
    })
    const { streamRecord } =
      await client.payment.getStreamRecord(paymentAddress)
    const formattedStreamRecord = {
      owner: account.paymentAccount.owner,
      refundable: account.paymentAccount.refundable,
      paymentAddress,
      settleDate: new Date(
        Number(streamRecord.settleTimestamp) * 1000
      ).toISOString(),
      updateDate: new Date(
        Number(streamRecord.crudTimestamp) * 1000
      ).toISOString(),
      status: StreamAccountStatus[streamRecord.status],
      netflowRate: streamRecord.netflowRate,
      staticBalance: streamRecord.staticBalance,
      bufferBalance: streamRecord.bufferBalance,
      lockBalance: streamRecord.lockBalance,
      frozenNetflowRate: streamRecord.frozenNetflowRate
    }
    return response.success(formattedStreamRecord)
  } catch (error: any) {
    return response.fail(`Failed to get payment account info: ${error.message}`)
  }
}

/**
 * Get store fee calculation configuration in Greenfield
 */
const _getStoreFeeConfig = async (
  network: "mainnet" | "testnet",
  timestamp?: number
) => {
  const client = getClient(network)
  const time = timestamp || Math.floor(+new Date() / 1000)
  const [
    globalSpStoragePrice,
    { params: storageParams },
    { params: paymentParams }
  ] = await Promise.all([
    client.sp.getQueryGlobalSpStorePriceByTime({
      timestamp: Long.fromNumber(time)
    }),
    client.storage.params(),
    client.payment.params()
  ])

  const {
    minChargeSize = new Long(0),
    redundantDataChunkNum = 0,
    redundantParityChunkNum = 0
  } = (storageParams && storageParams.versionedParams) || {}

  const { reserveTime, validatorTaxRate } = paymentParams?.versionedParams || {}

  return {
    primarySpStorePrice:
      globalSpStoragePrice?.globalSpStorePrice.primaryStorePrice || "",
    readPrice: globalSpStoragePrice?.globalSpStorePrice.readPrice || "",
    secondarySpStorePrice:
      globalSpStoragePrice?.globalSpStorePrice.secondaryStorePrice || "",
    validatorTaxRate: validatorTaxRate || "",
    minChargeSize: minChargeSize.toNumber(),
    redundantDataChunkNum,
    redundantParityChunkNum,
    reserveTime: reserveTime?.toString() || ""
  }
}

/**
 * Estimate the netflow rate per second for a specified size
 */
const _estimateStoreNetflowRate = (
  size: number,
  storeFeeConfig: StoreFeeConfig,
  isChargeSize = false
) => {
  const {
    primarySpStorePrice,
    secondarySpStorePrice,
    redundantDataChunkNum,
    redundantParityChunkNum,
    minChargeSize,
    validatorTaxRate
  } = storeFeeConfig
  const chargeSize = isChargeSize
    ? size
    : size >= minChargeSize
      ? size
      : minChargeSize
  const primarySpRate = Number(primarySpStorePrice) * chargeSize
  const secondarySpNum = redundantDataChunkNum + redundantParityChunkNum
  let secondarySpRate = Number(secondarySpStorePrice) * chargeSize
  secondarySpRate = secondarySpRate * secondarySpNum
  const validatorTax =
    Number(validatorTaxRate) * (primarySpRate + secondarySpRate)
  const netflowRate = primarySpRate + secondarySpRate + validatorTax

  return netflowRate / 10 ** 18
}

/**
 * Get the related buckets for a payment account
 */
export const getPaymentAccountRelatedBuckets = async (
  network: "testnet" | "mainnet",
  {
    paymentAddress,
    privateKey
  }: {
    paymentAddress: string
    privateKey: Hex
  }
) => {
  try {
    const client = getClient(network)
    const sp = await selectSp(network)
    const storeFeeConfig = await _getStoreFeeConfig(network)
    const ownerAccount = (await getAccount(network, privateKey)).address
    const buckets = await client.bucket.listBuckets({
      address: ownerAccount,
      endpoint: sp.endpoint
    })

    const { streamRecord } =
      await client.payment.getStreamRecord(paymentAddress)

    const relatedBuckets = buckets.body
      ?.filter((bucket) => {
        return (
          bucket.BucketInfo.PaymentAddress.toLowerCase() ===
          paymentAddress.toLowerCase()
        )
      })
      .map((bucket) => ({
        ...bucket,
        settlementDate: new Date(
          Number(streamRecord.settleTimestamp) * 1000
        ).toISOString(),
        netflowRateInSeconds: _estimateStoreNetflowRate(
          // @ts-ignore
          bucket.StorageSize,
          storeFeeConfig
        ),
        netflowRateInDays:
          // @ts-ignore
          _estimateStoreNetflowRate(bucket.StorageSize, storeFeeConfig) * 86400
      }))

    return response.success(relatedBuckets)
  } catch (error: any) {
    return response.fail(
      `Failed to get payment account related buckets: ${error.message}`
    )
  }
}
