#!/bin/bash

# Sync script to push updates from monorepo subdirectories to standalone repos
# Run this after making changes to binance-us-mcp-server or binance-mcp-server

set -e

echo "============================================"
echo "Syncing subdirectories to standalone repos"
echo "============================================"

# Make sure we have the remotes
if ! git remote | grep -q "^binance-us$"; then
    echo "Error: Remote 'binance-us' not found. Run setup-subtrees.sh first."
    exit 1
fi

if ! git remote | grep -q "^binance$"; then
    echo "Error: Remote 'binance' not found. Run setup-subtrees.sh first."
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Warning: You have uncommitted changes. Please commit them first."
    exit 1
fi

echo ""
echo "Pushing binance-us-mcp-server..."
git subtree push --prefix=binance-us-mcp-server binance-us main

echo ""
echo "Pushing binance-mcp-server..."
git subtree push --prefix=binance-mcp-server binance main

echo ""
echo "============================================"
echo "Sync complete!"
echo "============================================"
