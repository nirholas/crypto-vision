# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in UCAI, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email the maintainers directly at [contact@nirholas.dev](mailto:contact@nirholas.dev)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

## Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

## Security Best Practices

When using UCAI:

### Private Keys

- **Never** commit private keys to version control
- Use environment variables for sensitive data
- The `PRIVATE_KEY` environment variable is only needed for write operations

### Generated Servers

- Review generated code before deployment
- Use `--read-only` mode when write operations aren't needed
- Enable simulation mode (default) for write operations

### RPC Endpoints

- Use authenticated RPC endpoints in production
- Consider rate limits and access controls
- Avoid exposing RPC URLs in public repositories

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve UCAI's security.

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainer or open a private security advisory on GitHub
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before disclosure
