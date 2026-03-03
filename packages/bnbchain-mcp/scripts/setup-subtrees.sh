#!/bin/bash

# Setup script to push binance-us-mcp-server and binance-mcp-server as standalone repos
# while keeping them in the universal-crypto-mcp monorepo

set -e

GITHUB_USER="nirholas"

echo "============================================"
echo "Git Subtree Setup for Standalone Repos"
echo "============================================"
echo ""
echo "PREREQUISITE: Create these empty repos on GitHub first:"
echo "  1. https://github.com/${GITHUB_USER}/Binance-US-MCP (exists)"
echo "  2. https://github.com/${GITHUB_USER}/Binance-MCP"
echo ""
echo "Press Enter when ready, or Ctrl+C to cancel..."
read

# Add remotes for standalone repos
echo "Adding remotes..."
git remote add binance-us https://github.com/${GITHUB_USER}/Binance-US-MCP.git 2>/dev/null || echo "Remote 'binance-us' already exists"
git remote add binance https://github.com/${GITHUB_USER}/Binance-MCP.git 2>/dev/null || echo "Remote 'binance' already exists"

echo ""
echo "Current remotes:"
git remote -v

echo ""
echo "============================================"
echo "Pushing binance-us-mcp-server as standalone..."
echo "============================================"
git subtree push --prefix=binance-us-mcp-server binance-us main

echo ""
echo "============================================"
echo "Pushing binance-mcp-server as standalone..."
echo "============================================"
git subtree push --prefix=binance-mcp-server binance main

echo ""
echo "============================================"
echo "Done! Both repos have been pushed."
echo "============================================"
echo ""
echo "View them at:"
echo "  https://github.com/${GITHUB_USER}/Binance-US-MCP"
echo "  https://github.com/${GITHUB_USER}/Binance-MCP"
