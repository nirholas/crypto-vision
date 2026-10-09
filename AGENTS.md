# AGENTS.md

Operating notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) working in this repository. Everything here is derived from the files actually in the tree, so trust it over guesses, and update it when the facts change.

## What this repository is

The most comprehensive cryptocurrency API. Real-time prices, OHLCV, order books & market cap for 10,000+ tokens across 500+ exchanges. DeFi TVL, yields & protocol metrics. On-chain analytics & whale alerts. Crypto news & AI sentiment. Historical data. REST, WebSocket & GraphQL endpoints. Python, TypeScript, Go, React, PHP SDKs.

- Homepage: https://cryptocurrency.cv
- Source: https://github.com/nirholas/crypto-vision
- Primary language: TypeScript
- License: Other (see the LICENSE file)

## Repository layout

- `agents/`
- `apps/`
- `docs/`
- `infra/`
- `packages/`
- `prompts/`
- `scripts/`
- `src/`
- `tests/`
- `x402-facilitator/`
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `package.json`
- `Dockerfile`

Tests live in `tests/`. Add or update a test next to the code you change.

## Setup

```bash
npm install
```

## Commands

| Task | Command |
|---|---|
| dev | `npm run dev` |
| start | `npm start` |
| build | `npm run build` |
| test | `npm test` |
| lint | `npm run lint` |
| typecheck | `npm run typecheck` |
| run with Docker | `docker compose up` |
| build image | `docker build .` |

Run the test and lint commands above before you consider a change finished. If a command fails on code you did not touch, say so in your report instead of silently skipping it.

## Conventions

- TypeScript runs in strict mode; do not loosen `tsconfig.json` to make an error go away.
- `.env` files are gitignored; never commit credentials, and read configuration from environment variables.
- Commit messages follow Conventional Commits (`type(scope): summary`), matching the existing history.
- Read `CONTRIBUTING.md` before opening a pull request.
- User-visible changes get an entry in `CHANGELOG.md`.
- Read the surrounding code before adding to it, and match its naming, file organisation and error-handling style.
- Keep `README.md` accurate: if a change alters behaviour, commands or configuration, update the docs in the same commit.
- Do not leave TODO comments, stub functions, placeholder data or commented-out code behind. Finish what you start or leave it out.
- Small, focused commits with a subject line that describes the change, not the act of committing.

## Where to raise things

- Bugs and feature requests: https://github.com/nirholas/crypto-vision/issues
- Questions and ideas: https://github.com/nirholas/crypto-vision/discussions
- Security issues: follow `SECURITY.md`, never a public issue.
