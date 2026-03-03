/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerMulticallPrompts(server: McpServer) {
  server.prompt(
    "batch_portfolio_check",
    "Check a complete portfolio using multicall for efficiency",
    {
      address: { description: "Wallet address to analyze", required: true },
      network: { description: "Network to check", required: true }
    },
    ({ address, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a comprehensive portfolio check for ${address} on ${network} using multicall for efficiency.

Steps:
1. Get native balance using get_multi_native_balances
2. Get token balances for common tokens using get_multi_token_balances
3. Get token info for any unknown tokens using get_multi_token_info
4. Check allowances for common DEX routers using batch_check_allowances

Provide a formatted portfolio report including:
- Native token balance
- All token holdings with values
- Active allowances that may need review
- Total portfolio value estimate`
          }
        }
      ]
    })
  )

  server.prompt(
    "optimize_batch_calls",
    "Help optimize multiple contract calls into efficient batches",
    {
      calls: { description: "Description of the calls you need to make", required: true }
    },
    ({ calls }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me optimize these contract calls into efficient multicall batches: ${calls}

Analyze the calls and:
1. Group related calls that can be batched together
2. Identify dependencies that require sequential execution
3. Suggest the optimal multicall structure
4. Estimate gas savings compared to individual calls

Use encode_call_data to prepare the call data and execute_multicall to run them.`
          }
        }
      ]
    })
  )
}
