/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerDeploymentPrompts(server: McpServer) {
  server.prompt(
    "deploy_new_contract",
    "Guide through deploying a new smart contract",
    {
      contractType: { description: "Type of contract (token, nft, custom)", required: true },
      network: { description: "Target network for deployment", required: true }
    },
    ({ contractType, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me deploy a ${contractType} contract on ${network}.

Guide through:
1. Prepare the deployment:
   - Compile the contract (if source provided)
   - Verify bytecode is correct
   - Prepare constructor arguments

2. Choose deployment method:
   - Standard deployment: deploy_contract
   - Deterministic deployment: deploy_create2 (same address across chains)
   - Upgradeable deployment: deploy_proxy (UUPS or Transparent)

3. Deploy the contract:
   - Use appropriate deployment tool
   - Monitor transaction
   - Confirm deployment

4. Post-deployment:
   - Verify contract source: verify_contract
   - Configure contract (if needed)
   - Document deployment details

Provide:
## Deployment Checklist

### Pre-deployment
- [ ] Bytecode ready
- [ ] Constructor args prepared
- [ ] Gas estimated
- [ ] Network selected: ${network}

### Deployment Details
| Field | Value |
|-------|-------|
| Contract Type | ${contractType} |
| Network | ${network} |
| Deployer | [address] |
| Contract Address | [after deployment] |
| Transaction Hash | [after deployment] |

### Post-deployment
- [ ] Source verified
- [ ] Ownership configured
- [ ] Initial setup complete`
          }
        }
      ]
    })
  )

  server.prompt(
    "upgrade_proxy_contract",
    "Guide through upgrading a proxy contract to a new implementation",
    {
      proxyAddress: { description: "Address of the proxy contract", required: true },
      network: { description: "Network where proxy is deployed", required: true }
    },
    ({ proxyAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me upgrade proxy contract ${proxyAddress} on ${network}.

## Upgrade Process

### 1. Pre-upgrade Checks
- Verify current implementation address
- Confirm new implementation is deployed
- Check upgrade authorization

### 2. Safety Checks
- Storage layout compatibility
- Initializer not re-callable
- Access control preserved

### 3. Execute Upgrade
Use upgrade_proxy with:
- proxyAddress: ${proxyAddress}
- newImplementationAddress: [new impl]
- proxyType: [transparent/uups]

### 4. Post-upgrade Verification
- Confirm new implementation address
- Test basic functionality
- Verify state preserved

### Upgrade Report
| Step | Status |
|------|--------|
| Current impl verified | [ ] |
| New impl deployed | [ ] |
| Upgrade executed | [ ] |
| New impl verified | [ ] |
| Functionality tested | [ ] |`
          }
        }
      ]
    })
  )

  server.prompt(
    "deploy_cross_chain",
    "Deploy contract to multiple chains with same address using CREATE2",
    {
      chains: { description: "Comma-separated list of networks", required: true }
    },
    ({ chains }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Deploy contract with same address across chains: ${chains}

## Cross-Chain Deployment Guide

### 1. Prepare Deployment
- Compile contract with consistent settings
- Choose a unique salt
- Use predict_create2_address to verify address

### 2. Deploy on Each Chain
For each chain, use deploy_create2 with:
- Same bytecode
- Same salt
- Same constructor arguments

### 3. Verify Deployments
Confirm same address on all chains

### Deployment Matrix
| Chain | Status | Address |
|-------|--------|---------|
${chains.split(",").map(c => `| ${c.trim()} | Pending | - |`).join("\n")}

### Benefits
- Consistent address across all chains
- Simplified integration
- Better UX for users`
          }
        }
      ]
    })
  )

  server.prompt(
    "verify_deployed_contract",
    "Guide through verifying contract source code on block explorer",
    {
      contractAddress: { description: "Address of deployed contract", required: true },
      network: { description: "Network where contract is deployed", required: true }
    },
    ({ contractAddress, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Verify contract ${contractAddress} on ${network}.

## Verification Guide

### Required Information
1. **Source Code**: Exact source used for compilation
2. **Compiler Version**: e.g., v0.8.19+commit.7dd6d404
3. **Optimization Settings**: enabled/disabled, runs
4. **Constructor Arguments**: ABI-encoded (if any)
5. **API Key**: Block explorer API key

### Verification Steps
1. Gather all required information
2. Use verify_contract tool
3. Wait for verification result
4. Confirm on block explorer

### Checklist
- [ ] Source code matches deployed bytecode
- [ ] Compiler version exact match
- [ ] Optimization settings match
- [ ] Constructor args encoded correctly
- [ ] License type specified

### Result
Contract: ${contractAddress}
Network: ${network}
Status: [Pending verification]`
          }
        }
      ]
    })
  )
}
