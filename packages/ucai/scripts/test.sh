#!/bin/bash
set -e

# Default options
COVERAGE=""
MARKERS=""
VERBOSE="-v"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --cov|--coverage)
            COVERAGE="--cov=src/abi_to_mcp --cov-report=term-missing"
            shift
            ;;
        --unit)
            MARKERS="-m 'not integration'"
            shift
            ;;
        --integration)
            MARKERS="-m integration"
            shift
            ;;
        --quick|-q)
            VERBOSE=""
            shift
            ;;
        *)
            # Pass through to pytest
            break
            ;;
    esac
done

echo "Running tests..."
pytest tests/ $VERBOSE $COVERAGE $MARKERS "$@"
