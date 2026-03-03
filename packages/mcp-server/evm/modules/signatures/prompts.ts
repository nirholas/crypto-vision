/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerSignaturesPrompts(server: McpServer) {
  server.prompt(
    "create_gasless_approval",
    "Help create a gasless token approval using EIP-2612 permit",
    {
      tokenAddress: { description: "Token contract address", required: true },
      spender: { description: "Address to approve", required: true },
      amount: { description: "Amount to approve", required: true }
    },
    ({ tokenAddress, spender, amount }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me create a gasless approval for ${amount} of token ${tokenAddress} to spender ${spender}.

This uses EIP-2612 permit signatures to allow approvals without gas.

I'll need:
1. Token name (for domain)
2. Current nonce from the token contract
3. Deadline timestamp
4. Chain ID

Then use create_permit_signature to generate the signature.`
          }
        }
      ]
    })
  )

  server.prompt(
    "verify_signature_authenticity",
    "Verify that a signature is authentic and from the expected signer",
    {
      signature: { description: "Signature to verify", required: true },
      message: { description: "Original message", required: true },
      expectedSigner: { description: "Expected signer address", required: true }
    },
    ({ signature, message, expectedSigner }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Verify the authenticity of this signature:
Signature: ${signature}
Message: ${message}
Expected Signer: ${expectedSigner}

Use verify_message_signature to check if:
1. The signature is valid
2. The recovered signer matches the expected address
3. Report any discrepancies`
          }
        }
      ]
    })
  )
}
