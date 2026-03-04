#!/bin/bash

# =============================================================================
# Crypto Data Aggregator - Check All Script
# =============================================================================
# This script runs all quality checks: linting, type checking, and tests.
# Usage: ./scripts/check-all.sh
# =============================================================================

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emojis
CHECK="✅"
CROSS="❌"
LINT="🔍"
TYPE="📝"
TEST="🧪"
BUILD="🏗️"
CLOCK="⏱️"

# Track timing
SECONDS=0

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ${LINT} Crypto Data Aggregator - Check All ${LINT}            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Track results
LINT_RESULT=0
TYPE_RESULT=0
TEST_RESULT=0
BUILD_RESULT=0

# -----------------------------------------------------------------------------
# Run ESLint
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${LINT} Running ESLint...${NC}"
echo ""

if npm run lint; then
    echo ""
    echo -e "${GREEN}${CHECK} Linting passed${NC}"
    LINT_RESULT=0
else
    echo ""
    echo -e "${RED}${CROSS} Linting failed${NC}"
    LINT_RESULT=1
fi

echo ""
echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run TypeScript Type Check
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${TYPE} Running TypeScript type check...${NC}"
echo ""

if npx tsc --noEmit; then
    echo -e "${GREEN}${CHECK} Type check passed${NC}"
    TYPE_RESULT=0
else
    echo ""
    echo -e "${RED}${CROSS} Type check failed${NC}"
    TYPE_RESULT=1
fi

echo ""
echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run Tests
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${TEST} Running tests...${NC}"
echo ""

if npm run test:run; then
    echo ""
    echo -e "${GREEN}${CHECK} Tests passed${NC}"
    TEST_RESULT=0
else
    echo ""
    echo -e "${RED}${CROSS} Tests failed${NC}"
    TEST_RESULT=1
fi

echo ""
echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run Build (optional, can be slow)
# -----------------------------------------------------------------------------
if [ "$1" == "--with-build" ] || [ "$1" == "-b" ]; then
    echo -e "${YELLOW}${BUILD} Running build...${NC}"
    echo ""
    
    if npm run build; then
        echo ""
        echo -e "${GREEN}${CHECK} Build passed${NC}"
        BUILD_RESULT=0
    else
        echo ""
        echo -e "${RED}${CROSS} Build failed${NC}"
        BUILD_RESULT=1
    fi
    
    echo ""
    echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
    echo ""
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
DURATION=$SECONDS
MINUTES=$((DURATION / 60))
SECS=$((DURATION % 60))

echo ""

# Calculate total result
TOTAL_RESULT=$((LINT_RESULT + TYPE_RESULT + TEST_RESULT + BUILD_RESULT))

if [ $TOTAL_RESULT -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  ${CHECK} All Checks Passed! ${CHECK}                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  ${CROSS} Some Checks Failed ${CROSS}                    ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "  ${BLUE}Results:${NC}"
echo ""

# Lint result
if [ $LINT_RESULT -eq 0 ]; then
    echo -e "    ${GREEN}${CHECK} ESLint${NC}"
else
    echo -e "    ${RED}${CROSS} ESLint${NC}"
fi

# Type check result
if [ $TYPE_RESULT -eq 0 ]; then
    echo -e "    ${GREEN}${CHECK} TypeScript${NC}"
else
    echo -e "    ${RED}${CROSS} TypeScript${NC}"
fi

# Test result
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "    ${GREEN}${CHECK} Tests${NC}"
else
    echo -e "    ${RED}${CROSS} Tests${NC}"
fi

# Build result (if run)
if [ "$1" == "--with-build" ] || [ "$1" == "-b" ]; then
    if [ $BUILD_RESULT -eq 0 ]; then
        echo -e "    ${GREEN}${CHECK} Build${NC}"
    else
        echo -e "    ${RED}${CROSS} Build${NC}"
    fi
fi

echo ""
echo -e "  ${CLOCK} ${BLUE}Duration:${NC} ${MINUTES}m ${SECS}s"
echo ""

# Exit with appropriate code
if [ $TOTAL_RESULT -eq 0 ]; then
    echo -e "  ${GREEN}Ready to commit! 🚀${NC}"
    echo ""
    exit 0
else
    echo -e "  ${YELLOW}Please fix the issues above before committing.${NC}"
    echo ""
    exit 1
fi
