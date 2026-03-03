#!/bin/bash
set -e

echo "Building UCAI (abi-to-mcp)..."

# Clean previous builds
rm -rf dist/ build/ *.egg-info src/*.egg-info

# Build
python -m build

echo ""
echo "✓ Build complete"
echo ""
echo "Artifacts:"
ls -la dist/
