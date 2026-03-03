#!/bin/bash
set -e

echo "Running linters..."

# Ruff (linting)
echo ""
echo "=== Ruff (lint) ==="
ruff check src/ tests/

# Ruff (formatting)
echo ""
echo "=== Ruff (format check) ==="
ruff format --check src/ tests/

# MyPy (type checking)
echo ""
echo "=== MyPy ==="
mypy src/abi_to_mcp --ignore-missing-imports

echo ""
echo "✓ All checks passed"
