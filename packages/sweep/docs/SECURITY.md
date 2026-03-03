# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Sweep, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: security@sweep.exchange (or create a private security advisory)
3. Include detailed steps to reproduce the vulnerability
4. Allow up to 72 hours for an initial response

## Security Best Practices

### For Users

1. **Never share your private keys or seed phrases**
2. **Verify transaction details** before signing
3. **Use hardware wallets** for significant amounts
4. **Check contract addresses** against official sources

### For Developers

#### Environment Variables

```bash
# NEVER commit .env files with real values
# Always use .env.example as a template
cp .env.example .env
# Edit .env with your actual values
```

#### Secrets Management

- Use Kubernetes secrets or a secrets manager (Vault, AWS Secrets Manager) in production
- Never hardcode API keys or private keys in source code
- Rotate keys regularly
- Use separate keys for development/staging/production

#### Git Security Checklist

Before every commit:

```bash
# Check for secrets in staged files
git diff --cached | grep -iE "(api_key|apikey|secret|password|token|private)"

# Use git-secrets or similar tools
git secrets --scan
```

## Architecture Security

### Smart Contracts

| Control | Description |
|---------|-------------|
| **Ownable** | Admin functions restricted to owner |
| **Pausable** | Emergency pause capability |
| **ReentrancyGuard** | Protection against reentrancy attacks |
| **Permit2** | Gasless approvals with deadline protection |
| **Deadline checks** | All operations have expiration |

### API Security

| Control | Description |
|---------|-------------|
| **Rate Limiting** | Per-IP and per-wallet rate limits |
| **Authentication** | SIWE (Sign-In with Ethereum) |
| **Input Validation** | Zod schemas on all endpoints |
| **x402 Payments** | Prevents spam via payment requirement |

### Price Validation

Multi-oracle price validation prevents price manipulation:

1. **Primary Sources**: Chainlink, Pyth
2. **Secondary Sources**: CoinGecko, DefiLlama, DexScreener
3. **Confidence Scoring**: Prices must pass multiple validation checks
4. **Staleness Checks**: Reject prices older than threshold

### Token Validation

Before sweeping any token:

- ✅ Honeypot detection (simulated buy/sell)
- ✅ Liquidity check (minimum threshold)
- ✅ Holder count verification
- ✅ Contract verification
- ✅ Known scam token list check

## Sensitive Files

These files should NEVER be committed with real values:

| File | Purpose | Safe Version |
|------|---------|--------------|
| `.env` | Environment variables | `.env.example` |
| `k8s/secrets-*.yaml` | K8s secrets | `k8s/secrets.yaml` (template) |
| `*.key`, `*.pem` | Private keys | Never commit |
| `wallet.json` | Wallet exports | Never commit |

## Audit Status

| Component | Status | Last Audit |
|-----------|--------|------------|
| Smart Contracts | 🟡 Pending | - |
| API Server | 🟡 Pending | - |
| Frontend | 🟡 Pending | - |

## Dependencies

We use Dependabot and Snyk to monitor dependencies:

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

## Incident Response

In case of a security incident:

1. **Pause contracts** via guardian multisig
2. **Revoke compromised keys** immediately
3. **Notify affected users** if funds at risk
4. **Document and remediate** the vulnerability
5. **Post-mortem** and implement preventive measures

## Contact

- Security: security@sweep.exchange
- General: team@sweep.exchange
- Discord: [Sweep Community]
