# Simple Agent Example

Minimal ERC-8004 agent in ~20 lines of TypeScript.

## Quick Start

```bash
# Without on-chain registration (dev mode)
npx tsx examples/simple-agent/index.ts

# With on-chain registration
PRIVATE_KEY=0x... npx tsx examples/simple-agent/index.ts
```

## What It Does

1. Creates an agent with a "greeting" capability
2. Registers on ERC-8004 IdentityRegistry (if private key provided)
3. Serves A2A discovery at `/.well-known/agent.json`
4. Handles tasks at `/a2a`
5. Health check at `/health`

## Test It

```bash
# Check agent card
curl http://localhost:3000/.well-known/agent.json | jq

# Send a task
curl -X POST http://localhost:3000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tasks/send",
    "params": {
      "id": "test-1",
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "greeting"}]
      },
      "metadata": {"skill": "greeting"}
    }
  }'
```
