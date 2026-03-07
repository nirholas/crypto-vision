# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Crypto Vision, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email **nirholas@users.noreply.github.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)
3. You will receive acknowledgment within 48 hours
4. A fix will be developed and released before public disclosure

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch (latest) | Yes |
| Tagged releases | Yes |
| Older commits | No |

---

## Security Architecture

### Authentication & Authorization

- **API Key Authentication** — optional `x-api-key` header on all `/api/*` routes
- **Rate Limiting** — 200 requests/minute per IP (configurable)
- **Request Timeouts** — 30s for API routes, 60s for AI routes
- **CORS** — configurable origin allowlist, open in development

### Transport Security

- **HTTPS enforced** in production (Cloud Run terminates TLS)
- **HSTS** headers with 1-year max-age
- **CSP** (Content Security Policy) — restricts script/style sources
- **X-Frame-Options** — DENY (clickjacking protection)
- **X-Content-Type-Options** — nosniff (MIME sniffing protection)

### Input Validation

- **Zod schemas** validate all request parameters at route level
- **SQL parameterization** — Drizzle ORM prevents SQL injection
- **Path traversal** — no user-controlled file paths
- **Query parameter sanitization** — numeric bounds enforced on pagination

### Secret Management

| Environment | Method |
|-------------|--------|
| Development | `.env` file (git-ignored) |
| Production (GCP) | Secret Manager with IAM-scoped access |
| CI/CD | Cloud Build substitution variables |

### Secrets Hygiene

- **Never log secrets** — Pino logger excludes sensitive fields
- **Never commit secrets** — `.env` is in `.gitignore`
- **Push protection** — GitHub secret scanning blocks pushes containing API keys
- **Key rotation** — external API keys should be rotated quarterly

### Dependency Security

- Dependencies are pinned with `package-lock.json`
- `npm audit` should be run periodically
- Critical vulnerabilities must be patched within 7 days

---

## Crypto-Specific Security

### API Key Exposure

The API proxies requests to upstream services (CoinGecko, DeFiLlama, etc.). API keys for these services are:
- Stored in environment variables, never in code
- Not included in API responses
- Not logged in structured logs

### Token Security Scanning

The `/api/security/` endpoints integrate GoPlus Security for:
- Honeypot detection
- Hidden tax/fee detection
- Owner privilege analysis
- Phishing contract identification

 

- **Wallet isolation** — each agent role uses separate wallets
- **Fund limits** — configurable maximum SOL per wallet
- **Emergency exit** — sentinel agent monitors for threats, can trigger full exit
- **Anti-detection** — wallet fingerprint diversity prevents Sybil flagging
- **Profit sweeping** — automatic profit consolidation to master wallet
- **Audit logging** — all transactions logged with full context
- **Risk manager** — portfolio-level risk limits enforced before trades

### Solana RPC Security

- RPC endpoints configured via environment variables
- Connection pool with health checks and automatic failover
- No private keys transmitted over RPC (signing is local)

---

## Infrastructure Security

### Cloud Run

- Containers run as non-root `node` user
- Health check endpoint at `/health` (30s interval)
- Minimum 2 instances for availability
- Memory/CPU limits enforced (2Gi / 4 CPU)

### Kubernetes

- Network policies restrict pod-to-pod traffic
- Pod security policies enforce non-root containers
- Secrets mounted as volumes, not environment variables
- Pod disruption budgets prevent simultaneous eviction

### Database

- PostgreSQL connections use SSL in production
- Database credentials stored in Secret Manager
- Drizzle ORM prevents SQL injection
- Migrations tracked and versioned

---

## Incident Response

1. **Detect** — monitoring alerts, user reports, or automated scanning
2. **Assess** — determine scope and severity
3. **Contain** — isolate affected components
4. **Fix** — develop and deploy patch
5. **Communicate** — notify affected users if data was compromised
6. **Review** — post-incident review and prevention measures

---

## Security Headers Reference

Applied globally in `src/index.ts`:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
