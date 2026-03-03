# Security Best Practices

Guidelines for securely using the Binance.US MCP Server.

## API Key Security

### ⚠️ Critical Rules

1. **Never share your API keys** - Treat them like passwords
2. **Never commit keys to git** - Use environment variables
3. **Never expose keys in logs** - Mask sensitive data
4. **Rotate keys regularly** - Generate new keys periodically

### Storage

| ✅ Do | ❌ Don't |
|-------|---------|
| Use environment variables | Hardcode in source code |
| Use `.env` files (gitignored) | Commit `.env` to repository |
| Use secret managers | Store in plain text files |
| Encrypt at rest | Share via insecure channels |

### `.gitignore` Setup

```gitignore
# Environment files
.env
.env.local
.env.development
.env.production

# API keys
*.pem
*.key
secrets/
```

---

## Permission Principles

### Least Privilege

Only enable permissions you actually need:

| Use Case | Permissions |
|----------|-------------|
| View prices/data | None (public) |
| View account | Read only |
| Trading bot | Read + Trade |
| Full management | All (rarely needed) |

### Separate Keys for Different Uses

Create different API keys for:
- Development/testing
- Production trading
- Read-only monitoring
- Different applications

---

## IP Restrictions

### Always Use IP Whitelisting

1. Go to Binance.US → API Management
2. Edit your API key
3. Enable "Restrict access to trusted IPs only"
4. Add your server/home IP addresses

### Finding Your IP

```bash
# Linux/macOS
curl ifconfig.me

# Or
curl ipinfo.io/ip
```

### Dynamic IPs

If your IP changes frequently:
- Use a VPN with static IP
- Use a cloud server with fixed IP
- Set up a proxy with known IP

---

## Risk Mitigation

### Trading Safeguards

```typescript
// Always use test orders first
await binance_us_test_order({
  symbol: "BTCUSD",
  side: "BUY",
  type: "LIMIT",
  // ... params
});

// Then real order only after testing
await binance_us_new_order({ /* same params */ });
```

### Amount Limits

- Set conservative position sizes
- Implement daily trading limits
- Use stop-loss orders

### Withdrawal Protection

- **Disable withdrawal permission** unless absolutely necessary
- If enabled, whitelist withdrawal addresses
- Enable 2FA for all withdrawals

---

## Monitoring

### What to Monitor

| Metric | Why |
|--------|-----|
| API usage | Detect unauthorized access |
| Order history | Verify trading activity |
| Balance changes | Catch unexpected transfers |
| Login history | Detect account compromise |

### Alerts Setup

Set up alerts in Binance.US for:
- Large withdrawals
- New device logins
- API key creation/modification
- Large trades

---

## Incident Response

### If You Suspect Compromise

1. **Immediately delete the API key**
2. Check recent account activity
3. Review and cancel open orders
4. Change account password
5. Review 2FA settings
6. Contact Binance.US support if needed

### Recovery Steps

1. Create new API keys
2. Update all applications with new keys
3. Review security settings
4. Enable additional security measures
5. Monitor closely for 24-48 hours

---

## Network Security

### HTTPS Only

The client only uses HTTPS:
```typescript
BASE_URL: "https://api.binance.us"
WS_URL: "wss://stream.binance.us:9443"
```

### Certificate Validation

Node.js validates SSL certificates by default. Never disable this:

```typescript
// ❌ NEVER DO THIS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

### Firewall Rules

Allow only necessary outbound connections:
- `api.binance.us` (port 443)
- `stream.binance.us` (port 9443)

---

## Code Security

### Input Validation

All tool inputs are validated with Zod:

```typescript
server.tool(
  "binance_us_new_order",
  "...",
  {
    symbol: z.string().min(1),
    side: z.enum(["BUY", "SELL"]),
    quantity: z.number().positive(),
    // ...
  },
  async (params) => { /* handler */ }
);
```

### Error Handling

Never expose sensitive info in errors:

```typescript
// ✅ Good
return { error: "Authentication failed" };

// ❌ Bad
return { error: `Auth failed: key=${apiKey}` };
```

---

## Compliance

### Data Handling

- Don't log full account balances
- Don't store trade history longer than needed
- Implement data retention policies

### Regulatory

- Binance.US is regulated (SEC/FinCEN)
- API usage must comply with Terms of Service
- Automated trading may have restrictions

---

## Checklist

### Before Deployment

- [ ] API keys stored securely (env vars)
- [ ] `.env` in `.gitignore`
- [ ] IP restrictions enabled
- [ ] Minimal permissions set
- [ ] Test orders working
- [ ] Error handling in place
- [ ] Logging doesn't expose secrets

### Regular Maintenance

- [ ] Rotate API keys quarterly
- [ ] Review API permissions
- [ ] Check for unusual activity
- [ ] Update dependencies
- [ ] Review security logs
