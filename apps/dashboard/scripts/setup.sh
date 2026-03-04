#!/bin/bash

# =============================================================================
# Crypto Data Aggregator - Development Setup Script
# =============================================================================
# This script sets up the development environment with a single command.
# Usage: ./scripts/setup.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emojis
CHECK="✅"
CROSS="❌"
ROCKET="🚀"
PACKAGE="📦"
GEAR="⚙️"
HOOK="🪝"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ${ROCKET} Crypto Data Aggregator - Development Setup ${ROCKET}      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Check Prerequisites
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${GEAR} Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}${CROSS} Node.js is not installed. Please install Node.js >= 18.0.0${NC}"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}${CROSS} Node.js version must be >= 18.0.0 (current: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}${CHECK} Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}${CROSS} npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}${CHECK} npm $(npm -v)${NC}"

# Check git
if ! command -v git &> /dev/null; then
    echo -e "${RED}${CROSS} Git is not installed. Please install Git.${NC}"
    echo "   Download from: https://git-scm.com/"
    exit 1
fi
echo -e "${GREEN}${CHECK} Git $(git --version | cut -d ' ' -f 3)${NC}"

echo ""

# -----------------------------------------------------------------------------
# Install Dependencies
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${PACKAGE} Installing dependencies...${NC}"

npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}${CHECK} Dependencies installed successfully${NC}"
else
    echo -e "${RED}${CROSS} Failed to install dependencies${NC}"
    exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Setup Husky Git Hooks
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${HOOK} Setting up Git hooks (Husky)...${NC}"

npm run prepare 2>/dev/null || echo -e "${YELLOW}   Husky prepare script not found, skipping...${NC}"

if [ -d ".husky" ]; then
    echo -e "${GREEN}${CHECK} Git hooks configured${NC}"
else
    echo -e "${YELLOW}   Git hooks directory not found, this is okay for first setup${NC}"
fi

echo ""

# -----------------------------------------------------------------------------
# Verify Setup
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${GEAR} Verifying setup...${NC}"

# Check if we can run lint
echo -n "   Checking lint... "
if npm run lint --silent 2>/dev/null; then
    echo -e "${GREEN}${CHECK}${NC}"
else
    echo -e "${YELLOW}⚠️  (warnings found, but setup continues)${NC}"
fi

# Check if we can run build
echo -n "   Checking TypeScript... "
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}${CHECK}${NC}"
else
    echo -e "${YELLOW}⚠️  (type issues found, but setup continues)${NC}"
fi

echo ""

# -----------------------------------------------------------------------------
# Success Message
# -----------------------------------------------------------------------------
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ${CHECK} Setup Complete! ${CHECK}                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Quick Start Commands:${NC}"
echo ""
echo -e "    ${YELLOW}npm run dev${NC}          Start development server"
echo -e "    ${YELLOW}npm run build${NC}        Build for production"
echo -e "    ${YELLOW}npm run test${NC}         Run tests in watch mode"
echo -e "    ${YELLOW}npm run test:run${NC}     Run tests once"
echo -e "    ${YELLOW}npm run lint${NC}         Check for linting issues"
echo -e "    ${YELLOW}npm run lint:fix${NC}     Fix linting issues"
echo -e "    ${YELLOW}npm run check-all${NC}    Run all checks"
echo ""
echo -e "  ${BLUE}Development server will be available at:${NC}"
echo -e "    ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${ROCKET} Happy coding! ${ROCKET}"
echo ""
