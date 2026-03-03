/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hex } from "viem"
import { z } from "zod"

import * as services from "@/gnfd/services"
import { mcpToolRes } from "@/utils/helper"
import { networkParam, privateKeyParam } from "./common"

export function registerPaymentTools(server: McpServer) {
  // get payment account
  server.tool(
    "gnfd_get_payment_accounts",
    "Get the payment accounts for a given address",
    {
      network: networkParam,
      address: z
        .string()
        .optional()
        .describe(
          "The address of the payment account to get. If not provided, will use the private key to get the payment account."
        ),
      privateKey: privateKeyParam
    },
    async ({ network, address, privateKey }) => {
      try {
        const result = await services.getPaymentAccounts(network, {
          address,
          privateKey: privateKey as Hex
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "getting payment account")
      }
    }
  )

  // Create payment account
  server.tool(
    "gnfd_create_payment_account",
    "Create a new payment account",
    {
      network: networkParam,
      privateKey: privateKeyParam
    },
    async ({ network, privateKey }) => {
      try {
        const result = await services.createPaymentAccount(
          network,
          privateKey as Hex
        )
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "creating payment account")
      }
    }
  )

  // Deposit to payment account
  server.tool(
    "gnfd_deposit_to_payment",
    "Deposit funds into a payment account",
    {
      network: networkParam,
      to: z.string().describe("The payment account address to deposit to"),
      amount: z.string().describe("The amount to deposit (in BNB)"),
      privateKey: privateKeyParam
    },
    async ({ network, to, amount, privateKey }) => {
      try {
        const result = await services.depositToPaymentAccount(network, {
          to,
          amount,
          privateKey: privateKey as Hex
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "depositing to payment account")
      }
    }
  )

  // Withdraw from payment account
  server.tool(
    "gnfd_withdraw_from_payment",
    "Withdraw funds from a payment account",
    {
      network: networkParam,
      from: z.string().describe("The payment account address to withdraw from"),
      amount: z.string().describe("The amount to withdraw (in BNB)"),
      privateKey: privateKeyParam
    },
    async ({ network, from, amount, privateKey }) => {
      try {
        const result = await services.withdrawFromPaymentAccount(network, {
          from,
          amount,
          privateKey: privateKey as Hex
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "withdrawing from payment account")
      }
    }
  )

  // Disable refund for payment account
  // server.tool(
  //   "gnfd_disable_refund",
  //   "Disable refund for a payment account (IRREVERSIBLE)",
  //   {
  //     network: networkParam,
  //     address: z
  //       .string()
  //       .describe("The payment account address to disable refund for"),
  //     privateKey: privateKeyParam
  //   },
  //   async ({ network, address, privateKey }) => {
  //     try {
  //       const result = await services.disableRefundForPaymentAccount(network, {
  //         address,
  //         privateKey: privateKey as Hex
  //       })
  //       return mcpToolRes.success(result)
  //     } catch (error) {
  //       return mcpToolRes.error(error, "disabling refund for payment account")
  //     }
  //   }
  // )

  // Get payment account info
  server.tool(
    "gnfd_get_payment_account_info",
    "Get the info for a payment account",
    {
      network: networkParam,
      paymentAddress: z
        .string()
        .describe("The address of the payment account to get info for")
    },
    async ({ network, paymentAddress }) => {
      try {
        const result = await services.getPaymentAccountInfo(
          network,
          paymentAddress
        )
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "getting payment account info")
      }
    }
  )

  // // Get payment account related buckets
  // server.tool(
  //   "gnfd_get_payment_account_related_buckets",
  //   "Get the related buckets for a payment account",
  //   {
  //     network: networkParam,
  //     paymentAddress: z
  //       .string()
  //       .describe(
  //         "The address of the payment account to get related buckets for"
  //       ),
  //     privateKey: privateKeyParam
  //   },
  //   async ({ network, paymentAddress, privateKey }) => {
  //     try {
  //       const result = await services.getPaymentAccountRelatedBuckets(network, {
  //         paymentAddress,
  //         privateKey: privateKey as Hex
  //       })
  //       return mcpToolRes.success(result)
  //     } catch (error) {
  //       return mcpToolRes.error(
  //         error,
  //         "getting payment account related buckets"
  //       )
  //     }
  //   }
  // )
}
