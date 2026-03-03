# Standalone Repository Sync

This monorepo contains two Binance MCP servers that are also published as standalone repositories:

| Directory | Standalone Repo |
|-----------|----------------|
| `binance-us-mcp-server/` | [nirholas/Binance-US-MCP](https://github.com/nirholas/Binance-US-MCP) |
| `binance-mcp-server/` | [nirholas/Binance-MCP](https://github.com/nirholas/Binance-MCP) |

## How It Works

We use **git subtree** to maintain these directories in the monorepo while also pushing them to standalone repositories. This allows:

- Development in a unified monorepo with shared tooling
- Standalone repos for users who only need one specific MCP server
- Clean git history in standalone repos (only commits affecting that directory)

## Syncing Changes to Standalone Repos

After making changes to `binance-us-mcp-server/` or `binance-mcp-server/` and committing them to this repo, push the updates to the standalone repos:

```bash
# Ensure git-subtree is in PATH (Ubuntu/Debian)
export PATH="/usr/lib/git-core:$PATH"

# Push binance-us-mcp-server to Binance-US-MCP
git subtree push --prefix=binance-us-mcp-server binance-us main

# Push binance-mcp-server to Binance-MCP
git subtree push --prefix=binance-mcp-server binance main
```

Or use the sync script:

```bash
./scripts/sync-subtrees.sh
```

## Initial Setup (One-Time)

If the remotes aren't configured yet:

```bash
# Add remotes for standalone repos
git remote add binance-us https://github.com/nirholas/Binance-US-MCP.git
git remote add binance https://github.com/nirholas/Binance-MCP.git

# Verify remotes
git remote -v
```

## Force Push (Overwrite Standalone Repo)

If you need to completely overwrite a standalone repo (e.g., first push or resolving conflicts):

```bash
export PATH="/usr/lib/git-core:$PATH"

# For Binance-US-MCP
git subtree split --prefix=binance-us-mcp-server -b binance-us-split
git push binance-us binance-us-split:main --force
git branch -D binance-us-split

# For Binance-MCP
git subtree split --prefix=binance-mcp-server -b binance-split
git push binance binance-split:main --force
git branch -D binance-split
```

## Pulling Changes from Standalone Repos

If changes are made directly to a standalone repo and need to be merged back:

```bash
export PATH="/usr/lib/git-core:$PATH"

# Pull from Binance-US-MCP
git subtree pull --prefix=binance-us-mcp-server binance-us main --squash

# Pull from Binance-MCP
git subtree pull --prefix=binance-mcp-server binance main --squash
```

## Troubleshooting

### "git: 'subtree' is not a git command"

Add git-core to your PATH:

```bash
export PATH="/usr/lib/git-core:$PATH"
```

Or add to your `.bashrc` / `.zshrc` for persistence.

### Permission Denied

Ensure you have push access to the standalone repos. You may need to:

1. Be added as a collaborator on the repos
2. Use a Personal Access Token with `repo` scope
3. Configure SSH keys for authentication
