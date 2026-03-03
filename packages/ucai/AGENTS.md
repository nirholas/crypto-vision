# UCAI Development Guidelines

> Universal Contract AI Interface (UCAI) 🔗 ABI to MCP | The open standard for connecting AI agents to blockchain. MCP server generator for smart contracts. Claude + Uniswap, Aave, ERC20, NFTs, DeFi. Python CLI, Web3 integration, transaction simulation. Polygon, Arbitrum, Base, Ethereum EVM chains. Claude, GPT, LLM tooling, Solidity, OpenAI.

## Project Overview

UCAI is built with Python. See the README for full documentation.

### Project Philosophy

- **We have unlimited Claude credits** — never cut corners, never settle for "good enough." Build the best possible version of everything.
- **Always be improving** — every session should leave the codebase better than it was found. Proactively fix tech debt, improve performance, harden security, expand test coverage, and refine UX.
- **Ship production-quality code** — write thorough tests, handle edge cases, add meaningful error messages, and document public APIs.
- **Think big, execute precisely** — propose ambitious improvements but implement them carefully and incrementally.

### Continuous Improvement Mindset

Every time you touch a file, ask yourself:
1. **Can I make this faster?** — optimize hot paths, reduce allocations, cache aggressively
2. **Can I make this safer?** — add validation, tighten types, handle edge cases, sanitize inputs
3. **Can I make this cleaner?** — reduce duplication, improve naming, simplify logic, extract helpers
4. **Can I make this more testable?** — add missing tests, improve coverage, add integration tests
5. **Can I make this more observable?** — add structured logging, metrics, health checks, error context

If you see something broken or improvable while working on something else, **fix it**. Leave every file better than you found it (Boy Scout Rule).

### Proactive Engineering

- **Don't wait to be asked** — if you notice dead code, remove it. If you see a missing index, add it. If docs are stale, update them.
- **Anticipate failures** — add retry logic, circuit breakers, graceful degradation, and timeout handling where appropriate.
- **Think about the next developer** — write clear commit messages, helpful code comments, and self-documenting APIs.
- **Performance matters** — profile before optimizing, but always be aware of O(n) vs O(1), unnecessary re-renders, and N+1 queries.
- **Security is non-negotiable** — never log secrets, always validate inputs, use parameterized queries, and follow least privilege.

### Build & Run Discipline

- **Always verify your changes compile** — run the appropriate build/lint command after changes.
- **Always run tests** — run `pytest` (or the appropriate test command) after changes to ensure nothing is broken.
- **If a build or test fails, fix it immediately** — never leave the codebase in a broken state.

### Git Identity

- **Always commit and push as `nirholas`** — before any git commit or push, configure:
  ```
  git config user.name "nirholas"
  git config user.email "nirholas@users.noreply.github.com"
  ```

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal

## Contributing

- Follow the existing code style
- Test changes before submitting PRs
- Update documentation when adding features
- See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines
