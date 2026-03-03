/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { BaseAccount } from "@bnb-chain/greenfield-cosmos-types/cosmos/auth/v1beta1/auth"
import { type TxResponse } from "@bnb-chain/greenfield-js-sdk"
import type { Hex } from "viem"

import Logger from "@/utils/logger"
import { response, type ApiResponse } from "../util"

/**
 * Execute a transaction with proper error handling
 * @param tx Transaction to execute
 * @param account Account details
 * @param privateKey Private key for signing
 * @param operationName Name of operation for logging
 * @param successDetail Additional details for success message
 */
export const executeTransaction = async <T = void>(
  tx: TxResponse,
  account: BaseAccount,
  privateKey: Hex,
  operationName: string,
  successDetail: string
): Promise<ApiResponse<T> & { txHash?: string }> => {
  const denom = "BNB"

  try {
    // Simulate transaction to get gas estimate
    const simulateTx = await tx.simulate({
      denom
    })

    // Broadcast transaction
    const txRes = await tx.broadcast({
      denom,
      gasLimit: Number(simulateTx?.gasLimit),
      gasPrice: simulateTx?.gasPrice || "5000000000",
      payer: account.address,
      granter: "",
      privateKey: privateKey
    })

    if (txRes.code === 0) {
      Logger.debug(`${operationName} ${successDetail} success`)
      return response.success<T>(`${operationName} successful`, {
        txHash: txRes.transactionHash
      } as T)
    } else {
      Logger.error(`${operationName} failed: ${JSON.stringify(txRes)}`)
      return response.fail(
        `${operationName} failed: code=${txRes.code}, hash=${txRes.transactionHash}`
      ) as ApiResponse<T>
    }
  } catch (error) {
    Logger.error(`${operationName} failed: ${error}`)
    return response.fail(`${operationName} failed: ${error}`) as ApiResponse<T>
  }
}
