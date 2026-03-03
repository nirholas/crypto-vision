#!/bin/bash
#
# Deploy Script
# Deploy to Vercel or Railway with pre-flight checks
#
# Usage:
#   ./scripts/deploy.sh              # Deploy to Vercel (production)
#   ./scripts/deploy.sh --preview    # Deploy preview
#   ./scripts/deploy.sh --railway    # Deploy to Railway
#   ./scripts/deploy.sh --dry-run    # Check without deploying
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DRY_RUN=false
PREVIEW=false
PLATFORM="vercel"
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --preview|-p)
            PREVIEW=true
            shift
            ;;
        --railway)
            PLATFORM="railway"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--preview] [--railway] [--dry-run] [--skip-tests]"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

cd "$PROJECT_ROOT"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Deploy to ${PLATFORM^}${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}   (DRY RUN - no deployment will occur)${NC}"
fi
if [ "$PREVIEW" = true ]; then
    echo -e "${YELLOW}   (PREVIEW deployment)${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Pre-flight checks
echo -e "${YELLOW}📋 Pre-flight Checks${NC}"
CHECKS_PASSED=true

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
else
    echo -e "${GREEN}✅ Working directory clean${NC}"
fi

# Check branch
BRANCH=$(git branch --show-current)
if [ "$PREVIEW" = false ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    echo -e "${YELLOW}⚠️  Not on main branch (current: $BRANCH)${NC}"
else
    echo -e "${GREEN}✅ Branch: $BRANCH${NC}"
fi

# Check CLI tools
if [ "$PLATFORM" = "vercel" ]; then
    if command -v vercel &> /dev/null; then
        echo -e "${GREEN}✅ Vercel CLI installed${NC}"
    else
        echo -e "${RED}❌ Vercel CLI not installed (npm i -g vercel)${NC}"
        CHECKS_PASSED=false
    fi
elif [ "$PLATFORM" = "railway" ]; then
    if command -v railway &> /dev/null; then
        echo -e "${GREEN}✅ Railway CLI installed${NC}"
    else
        echo -e "${RED}❌ Railway CLI not installed${NC}"
        CHECKS_PASSED=false
    fi
fi

# Type check
echo -e "${YELLOW}🔍 Type checking...${NC}"
if npx tsc --noEmit 2>&1 | tail -5; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
else
    echo -e "${RED}❌ TypeScript errors found${NC}"
    CHECKS_PASSED=false
fi

# Lint
echo -e "${YELLOW}🔍 Linting...${NC}"
if npm run lint --silent 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Lint passed${NC}"
else
    echo -e "${YELLOW}⚠️  Lint warnings (non-blocking)${NC}"
fi

# Build test
echo -e "${YELLOW}🔍 Testing build...${NC}"
if npm run build 2>&1 | tail -10; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    CHECKS_PASSED=false
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}🔍 Running tests...${NC}"
    if npm run test:run 2>&1 | tail -10; then
        echo -e "${GREEN}✅ Tests passed${NC}"
    else
        echo -e "${RED}❌ Tests failed${NC}"
        CHECKS_PASSED=false
    fi
else
    echo -e "${YELLOW}⏭️  Skipping tests${NC}"
fi

echo ""

if [ "$CHECKS_PASSED" = false ]; then
    echo -e "${RED}❌ Pre-flight checks failed. Fix issues before deploying.${NC}"
    exit 1
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to deploy.${NC}"
    exit 0
fi

# Deploy
echo -e "${YELLOW}🚀 Deploying...${NC}"
echo ""

if [ "$PLATFORM" = "vercel" ]; then
    if [ "$PREVIEW" = true ]; then
        vercel
    else
        vercel --prod
    fi
elif [ "$PLATFORM" = "railway" ]; then
    railway up
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Post-deploy health check
if [ "$PREVIEW" = false ]; then
    echo ""
    echo -e "${YELLOW}🏥 Running post-deploy health check...${NC}"
    sleep 5
    if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
        bash "$SCRIPT_DIR/health-check.sh" || true
    fi
fi
