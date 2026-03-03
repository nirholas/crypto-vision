#!/bin/bash
set -e

# Check for required tools
command -v twine >/dev/null 2>&1 || { echo "twine required: pip install twine"; exit 1; }

# Ensure clean state
if [[ -n $(git status --porcelain) ]]; then
    echo "Error: Working directory not clean"
    exit 1
fi

# Get version
VERSION=$(python -c "from src.abi_to_mcp.version import __version__; print(__version__)")
echo "Releasing version $VERSION..."

# Build
./scripts/build.sh

# Upload to PyPI
echo ""
echo "Uploading to PyPI..."
twine upload dist/*

echo ""
echo "✓ Released version $VERSION"
