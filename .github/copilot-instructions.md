### Project Philosophy

- **We have unlimited Claude credits** — never cut corners, never settle for "good enough." Build the best possible version of everything.
- **Always be improving** — every session should leave the codebase better than it was found. Proactively fix tech debt, improve performance, harden security, expand test coverage, and refine UX.
- **Ship production-quality code** — write thorough tests, handle edge cases, add meaningful error messages, and document public APIs.
- **Think big, execute precisely** — propose ambitious improvements but implement them carefully and incrementally.

### No Mocks, No Fakes, No Stubs

- **Always write full, real implementations** — never use placeholder data, mock responses, fake APIs, TODO stubs, or hardcoded dummy values.
- **Connect to real services** — if a feature calls an API, implement the actual HTTP client with proper error handling, retries, and timeouts.
- **No "coming soon" or empty shells** — every function must do real work. If a dependency isn't available yet, build the adapter so it's ready to plug in.
- **No `// TODO: implement later`** — if you write a function signature, implement it fully right now. We have the credits. Do the work.
- **Tests use real logic** — test against actual behavior, not mocked internals. Use integration tests with real data flows where possible.

### Code Quality Standards

- **TypeScript strict mode** — no `any` types, no `@ts-ignore`, no type assertions unless absolutely unavoidable (and document why).
- **Error handling everywhere** — every async call needs try/catch, every API response needs validation, every edge case needs a code path.
- **Consistent patterns** — follow existing code conventions. If the codebase uses a pattern, replicate it. Don't introduce competing paradigms.
- **Self-documenting code** — prefer clear naming over comments. When comments are needed, explain *why*, not *what*.
- **DRY but not over-abstracted** — extract shared logic into helpers, but don't create abstractions for single-use cases.

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

### Completion & Follow-Through

- **Finish what you start** — don't leave partial implementations. If you open a file to change one thing and notice three others, fix all four.
- **Verify end-to-end** — after implementing a feature, trace the full path: route → handler → service → response. Confirm it works.
- **Run the full test suite** — don't just test the file you changed. Run all tests to catch regressions.
- **Check for orphans** — after refactoring, ensure no dead imports, unused exports, or dangling references remain.
- **Update docs and types** — if you change an API, update the OpenAPI spec, README, type definitions, and any consuming code.

### Build & Run Discipline

- **Always verify your changes compile** — run `npx tsc --noEmit` after TypeScript changes.
- **Always run tests** — run `npx vitest run` (or the appropriate test command) after changes to ensure nothing is broken.
- **Start the server and smoke-test** — after meaningful changes, spin up the dev server and hit key endpoints to verify behavior end-to-end.
- **If a build or test fails, fix it immediately** — never leave the codebase in a broken state.
- **Commit working code frequently** — small, focused commits with clear messages are better than large, monolithic ones.

### Git Identity

- **Always commit and push as `nirholas`** — before any git commit or push, configure:
  ```
  git config user.name "nirholas"
  git config user.email "nirholas@users.noreply.github.com"
  ```

### Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command so a terminal ID is returned
- **Always kill the terminal** after the command completes, whether it succeeds or fails — never leave terminals open
- **Kill terminals immediately** — as soon as you have the output you need, kill the terminal. Do not leave any terminals lingering.
- Do not reuse foreground shell sessions — stale sessions block future terminal operations in Codespaces
- In GitHub Codespaces, agent-spawned terminals may be hidden — they still work. Do not assume a terminal is broken if you cannot see it
- If a terminal appears unresponsive, kill it and create a new one rather than retrying in the same terminal
- **Chain commands** with `&&` to minimize the number of terminal invocations
- **Use timeouts** on commands that might hang — never let a terminal block indefinitely

### Model & Agent Preferences

- **Always use Claude Opus 4.6** — this is the only model approved for this project. Do not downgrade to Sonnet or other models.
- **Auto-approve everything** — all terminal commands, file edits, and tool calls should execute without manual confirmation.
- **Never open file editors in VS Code** — when creating or editing files, use tools directly (`create_file`, `replace_string_in_file`, `multi_replace_string_in_file`). Do not trigger the VS Code editor UI. We are in Codespaces and opening editors wastes resources and causes UI flicker.
- **Never ask for permission** — if the task is clear, execute it. Only ask questions when genuinely ambiguous requirements exist.

### Autonomous Workflow Efficiency

- **Parallelize independent operations** — read multiple files, run multiple searches, and make multiple edits simultaneously when they don't depend on each other.
- **Batch edits with `multi_replace_string_in_file`** — when making multiple changes across files, batch them into a single call instead of sequential edits.
- **Minimize round-trips** — gather all context you need in one parallel batch before starting implementation.
- **Use `search_subagent` for exploration** — don't do sequential grep/semantic searches manually. Launch a search subagent for complex codebase exploration.
- **Use `runSubagent` for complex sub-tasks** — delegate research-heavy or multi-step sub-tasks to sub-agents to maintain focus.
- **Track progress with `manage_todo_list`** — for multi-step tasks, always maintain a todo list so progress is visible and nothing is forgotten.
- **Prefer large file reads** — read 100+ lines at once instead of many small reads. Read all relevant sections in parallel.
- **Don't announce tools** — never say "I'll use X tool." Just use it and report results.
- **Stream results, not plans** — show what you did, not what you're about to do. Act first, summarize after.
