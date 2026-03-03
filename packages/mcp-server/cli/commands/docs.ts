/**
 * Documentation Generator Command
 * Auto-generates API documentation for x402-enabled APIs
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const c = (color: keyof typeof colors, text: string) =>
  `${colors[color]}${text}${colors.reset}`;

export interface DocsConfig {
  name: string;
  description: string;
  url: string;
  payment: {
    wallet: `0x${string}`;
    network: string;
    facilitator: string;
  };
  pricing: {
    routes: Record<string, string>;
  };
}

/**
 * Load configuration from x402.config.json
 */
function loadConfig(): DocsConfig {
  const configPath = join(process.cwd(), 'x402.config.json');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      name: config.name || 'My API',
      description: config.description || 'A paid API powered by x402',
      url: config.url || 'https://api.example.com',
      payment: {
        wallet: config.payment?.wallet || '0x40252CFDF8B20Ed757D61ff157719F33Ec332402',
        network: config.payment?.network || 'eip155:8453',
        facilitator: config.payment?.facilitator || 'https://facilitator.x402.org',
      },
      pricing: {
        routes: config.pricing?.routes || {
          'GET /data': '0.001',
          'POST /data': '0.002',
        },
      },
    };
  }

  // Return defaults
  return {
    name: 'My API',
    description: 'A paid API powered by x402',
    url: 'https://api.example.com',
    payment: {
      wallet: '0x40252CFDF8B20Ed757D61ff157719F33Ec332402',
      network: 'eip155:8453',
      facilitator: 'https://facilitator.x402.org',
    },
    pricing: {
      routes: {
        'GET /data': '0.001',
        'POST /data': '0.002',
      },
    },
  };
}

/**
 * Convert route string to method name
 */
function routeToMethodName(method: string, path: string): string {
  const parts = path.split('/').filter(p => p && !p.startsWith(':'));
  const name = parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return method.toLowerCase() + name;
}

/**
 * Convert string to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Generate endpoint documentation
 */
function generateEndpointDocs(routes: Record<string, string>, apiUrl: string): string {
  return Object.entries(routes)
    .map(([route, price]) => {
      const [method, path] = route.split(' ');
      const hasParams = path.includes(':');
      const params = path.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];

      return `
### \`${method} ${path}\`

**Price:** $${price} per call

${params.length > 0 ? `**Path Parameters:**
${params.map(p => `- \`${p}\` (required) - The ${p} identifier`).join('\n')}
` : ''}

**Request:**
\`\`\`bash
curl -X ${method} \\
  -H "x-payment: <proof>" \\
  ${hasParams ? '-H "Content-Type: application/json" \\' : ''}
  ${apiUrl}${path.replace(/:(\w+)/g, '<$1>')}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    // Response data here
  }
}
\`\`\`

**Error Responses:**
- \`402\` Payment Required - No valid payment proof provided
- \`403\` Forbidden - Invalid payment proof
- \`404\` Not Found - Resource not found
`;
    })
    .join('\n');
}

/**
 * Generate pricing table
 */
function generatePricingTable(routes: Record<string, string>): string {
  const rows = Object.entries(routes).map(([route, price]) => {
    const [method, path] = route.split(' ');
    return `| ${method} | ${path} | $${price} |`;
  });

  return `
| Method | Path | Price |
|--------|------|-------|
${rows.join('\n')}
`;
}

/**
 * Generate SDK examples
 */
function generateSDKExamples(config: DocsConfig): string {
  const clientName = config.name
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^./, char => char.toUpperCase());
  
  const snakeName = toSnakeCase(config.name);

  return `
## Client SDKs

We provide auto-generated SDKs for easy integration. Generate them using:

\`\`\`bash
x402-deploy generate-sdk --language all
\`\`\`

### TypeScript/JavaScript

\`\`\`typescript
import { ${clientName}Client } from './${config.name.toLowerCase()}-sdk';

// Initialize client with your payer key
const client = new ${clientName}Client({
  payerPrivateKey: process.env.PAYER_KEY as \`0x\${string}\`
});

// Make API calls - payment is handled automatically
const result = await client.getData('123');
console.log(result);

// Get discovery document
const discovery = await client.getDiscovery();
console.log(discovery);
\`\`\`

### Python

\`\`\`python
import os
from ${snakeName}_sdk import ${clientName}Client

# Initialize client with your payer key
client = ${clientName}Client(
    payer_private_key=os.environ['PAYER_KEY']
)

# Make API calls - payment is handled automatically
result = client.get_data('123')
print(result)

# Using context manager for proper cleanup
with ${clientName}Client(payer_private_key=os.environ['PAYER_KEY']) as client:
    result = client.get_data('123')
\`\`\`

### Go

\`\`\`go
package main

import (
    "fmt"
    "${config.name.toLowerCase()}/sdk/go"
)

func main() {
    // Initialize client with your payer key
    client := ${config.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.NewClient(
        ${config.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.WithPayerKey(os.Getenv("PAYER_KEY")),
    )

    // Make API calls - payment is handled automatically
    result, err := client.GetData("123")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(string(result))
}
\`\`\`
`;
}

export interface GenerateDocsOptions {
  /** Output file path */
  output?: string;
  /** Output format */
  format?: 'markdown' | 'html';
}

/**
 * Generate documentation command
 */
export async function generateDocsCommand(options: GenerateDocsOptions = {}): Promise<void> {
  console.log(c('bold', c('cyan', '\n📚 Generating documentation...\n')));

  const config = loadConfig();
  const outputPath = options.output || 'API.md';

  const markdown = `# ${config.name} API Documentation

${config.description}

---

## Quick Start

### 1. Get Payment Credentials

This API uses the [x402 payment protocol](https://x402.org) for authentication. 
To make API calls, you'll need:

1. A cryptocurrency wallet with funds
2. Access to an x402 facilitator service

### 2. Install SDK

\`\`\`bash
# TypeScript/JavaScript
npm install ${config.name.toLowerCase()}-sdk

# Python
pip install ${config.name.toLowerCase()}-sdk

# Or generate from source
x402-deploy generate-sdk --language all
\`\`\`

### 3. Make Your First Call

\`\`\`bash
curl -X GET \\
  -H "x-payment: <your-payment-proof>" \\
  ${config.url}/data
\`\`\`

---

## Authentication

All API endpoints require an x402 payment proof in the \`x-payment\` header.

\`\`\`bash
curl -H "x-payment: <proof>" ${config.url}/endpoint
\`\`\`

### Getting Payment Proofs

1. **Manual:** Visit [x402.org/facilitator](https://x402.org/facilitator)
2. **SDK:** Use our auto-generated SDKs (recommended)
3. **Direct:** Integrate with the facilitator API

### Payment Flow

1. Client requests payment proof from facilitator
2. Facilitator returns signed proof with payment commitment
3. Client sends request with \`x-payment\` header
4. Server verifies payment and processes request
5. Payment is settled on-chain

---

## Pricing

${generatePricingTable(config.pricing.routes)}

All prices are in USD and settled in cryptocurrency (USDC on Base network).

---

## Endpoints

${generateEndpointDocs(config.pricing.routes, config.url)}

---

${generateSDKExamples(config)}

---

## Discovery

This API publishes an x402 discovery document at:

\`\`\`
${config.url}/.well-known/x402
\`\`\`

The discovery document contains:
- Wallet address
- Supported networks
- Facilitator URL
- Route pricing information

---

## Error Handling

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| \`400\` | Bad Request | Invalid request format or parameters |
| \`402\` | Payment Required | No valid payment proof provided |
| \`403\` | Forbidden | Payment verification failed |
| \`404\` | Not Found | Resource not found |
| \`429\` | Too Many Requests | Rate limit exceeded |
| \`500\` | Server Error | Internal server error |

### Error Response Format

\`\`\`json
{
  "error": "Payment Required",
  "message": "Missing x-payment header",
  "code": 402,
  "details": {
    "price": "0.001",
    "wallet": "${config.payment.wallet}",
    "facilitator": "${config.payment.facilitator}"
  }
}
\`\`\`

---

## Configuration

- **API URL:** \`${config.url}\`
- **Wallet:** \`${config.payment.wallet}\`
- **Network:** \`${config.payment.network}\`
- **Facilitator:** \`${config.payment.facilitator}\`

---

## Rate Limits

| Tier | Requests/min | Requests/day |
|------|--------------|--------------|
| Standard | 60 | 10,000 |
| Premium | 300 | 100,000 |
| Enterprise | Unlimited | Unlimited |

Rate limits are applied per payer address.

---

## Changelog

### v1.0.0 (Current)
- Initial release
- x402 payment integration
- Auto-generated SDKs

---

## Support

- **Documentation:** [x402.org/docs](https://x402.org/docs)
- **GitHub:** [github.com/x402](https://github.com/x402)
- **Discord:** [discord.gg/x402](https://discord.gg/x402)

---

*Generated by [x402-deploy](https://x402.org) on ${new Date().toISOString().split('T')[0]}*
`;

  writeFileSync(outputPath, markdown);
  console.log(c('green', `✓ Documentation generated: ${outputPath}\n`));

  console.log(c('dim', 'Contents:'));
  console.log(c('dim', '  - Quick Start guide'));
  console.log(c('dim', '  - Authentication details'));
  console.log(c('dim', '  - Pricing table'));
  console.log(c('dim', `  - ${Object.keys(config.pricing.routes).length} endpoint(s) documented`));
  console.log(c('dim', '  - SDK examples (TypeScript, Python, Go)'));
  console.log(c('dim', '  - Error handling'));
  console.log();
}

export default generateDocsCommand;
