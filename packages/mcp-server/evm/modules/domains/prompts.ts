/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerDomainsPrompts(server: McpServer) {
  server.prompt(
    "ens_profile_lookup",
    "Get a complete ENS profile for a name or address",
    {
      identifier: { description: "ENS name or Ethereum address", required: true }
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Get the complete ENS profile for: ${identifier}

If it's an address, first do a reverse lookup.
Then get all available information:

1. Use resolve_ens_name or reverse_resolve_address
2. Get text records with get_ens_text_records
3. Get avatar with get_ens_avatar
4. Get full details with get_ens_name_details

Format as:
## ENS Profile

### Identity
- Name: [ENS name]
- Address: [Resolved address]

### Avatar
[Avatar URL or "No avatar set"]

### Social Links
[Twitter, GitHub, Discord, etc.]

### Other Records
[Any other text records found]`
          }
        }
      ]
    })
  )

  server.prompt(
    "identify_addresses",
    "Identify multiple addresses by their ENS names",
    {
      addresses: { description: "Comma-separated list of addresses", required: true }
    },
    ({ addresses }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Identify these addresses by their ENS names: ${addresses}

Use batch_resolve_addresses to look up all addresses at once.

Present results as:
| Address | ENS Name | 
|---------|----------|
[Results]`
          }
        }
      ]
    })
  )
}
