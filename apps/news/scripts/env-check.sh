#!/bin/bash
#
# Environment Check
# Validates required and optional environment variables
#
# Usage:
#   ./scripts/env-check.sh           # Check current environment
#   ./scripts/env-check.sh --strict  # Fail on missing optional vars
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

STRICT=false
MISSING_REQUIRED=0
MISSING_OPTIONAL=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --strict)
            STRICT=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--strict]"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

cd "$PROJECT_ROOT"

# Load .env.local if exists
if [ -f ".env.local" ]; then
    set -a
    source .env.local 2>/dev/null || true
    set +a
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 Environment Variable Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_var() {
    local var_name=$1
    local required=${2:-false}
    local description=${3:-""}
    local masked=${4:-false}
    
    local value="${!var_name:-}"
    
    if [ -n "$value" ]; then
        if [ "$masked" = true ]; then
            local display="${value:0:4}****${value: -4}"
            echo -e "${GREEN}✅${NC} $var_name = $display"
        else
            if [ ${#value} -gt 50 ]; then
                echo -e "${GREEN}✅${NC} $var_name = ${value:0:50}..."
            else
                echo -e "${GREEN}✅${NC} $var_name = $value"
            fi
        fi
    else
        if [ "$required" = true ]; then
            echo -e "${RED}❌${NC} $var_name ${RED}(required)${NC}"
            if [ -n "$description" ]; then
                echo -e "   ${CYAN}ℹ️  $description${NC}"
            fi
            ((MISSING_REQUIRED++))
        else
            echo -e "${YELLOW}⚠️${NC}  $var_name ${YELLOW}(optional)${NC}"
            if [ -n "$description" ]; then
                echo -e "   ${CYAN}ℹ️  $description${NC}"
            fi
            ((MISSING_OPTIONAL++))
        fi
    fi
}

check_var_exists() {
    local var_name=$1
    [ -n "${!var_name:-}" ]
}

# System
echo -e "${YELLOW}🖥️  System${NC}"
echo -e "${GREEN}✅${NC} NODE_ENV = ${NODE_ENV:-development}"
echo -e "${GREEN}✅${NC} PWD = $PWD"
check_var "PORT" false "Server port (default: 3000)"
echo ""

# Required for production
echo -e "${YELLOW}🔐 Core (Required for Production)${NC}"
check_var "NEXT_PUBLIC_BASE_URL" false "Base URL for the app"
check_var "NEXT_PUBLIC_API_URL" false "API URL"
echo ""

# AI Features
echo -e "${YELLOW}🤖 AI Features${NC}"
check_var "GROQ_API_KEY" false "Groq AI API key" true
check_var "OPENAI_API_KEY" false "OpenAI API key" true
check_var "ANTHROPIC_API_KEY" false "Anthropic API key" true
echo ""

# Redis / Caching
echo -e "${YELLOW}📦 Redis / Caching${NC}"
check_var "REDIS_URL" false "Redis connection URL" true
check_var "UPSTASH_REDIS_REST_URL" false "Upstash Redis REST URL"
check_var "UPSTASH_REDIS_REST_TOKEN" false "Upstash Redis token" true
check_var "KV_REST_API_URL" false "Vercel KV URL"
check_var "KV_REST_API_TOKEN" false "Vercel KV token" true
echo ""

# Analytics & Monitoring
echo -e "${YELLOW}📊 Analytics & Monitoring${NC}"
check_var "NEXT_PUBLIC_VERCEL_ANALYTICS_ID" false "Vercel Analytics"
check_var "SENTRY_DSN" false "Sentry error tracking"
check_var "SENTRY_AUTH_TOKEN" false "Sentry auth token" true
echo ""

# Payments
echo -e "${YELLOW}💳 Payments${NC}"
check_var "STRIPE_SECRET_KEY" false "Stripe secret key" true
check_var "STRIPE_WEBHOOK_SECRET" false "Stripe webhook secret" true
check_var "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" false "Stripe publishable key"
echo ""

# External APIs
echo -e "${YELLOW}🌐 External APIs${NC}"
check_var "COINGECKO_API_KEY" false "CoinGecko API key" true
check_var "COINMARKETCAP_API_KEY" false "CoinMarketCap API key" true
check_var "ETHERSCAN_API_KEY" false "Etherscan API key" true
check_var "TWITTER_BEARER_TOKEN" false "Twitter/X API token" true
check_var "TELEGRAM_BOT_TOKEN" false "Telegram bot token" true
check_var "DISCORD_WEBHOOK_URL" false "Discord webhook URL"
echo ""

# Admin
echo -e "${YELLOW}🔑 Admin${NC}"
check_var "ADMIN_API_KEY" false "Admin API key" true
check_var "JWT_SECRET" false "JWT secret" true
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ $MISSING_REQUIRED -gt 0 ]; then
    echo -e "${RED}❌ Missing $MISSING_REQUIRED required variable(s)${NC}"
fi

if [ $MISSING_OPTIONAL -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing $MISSING_OPTIONAL optional variable(s)${NC}"
fi

if [ $MISSING_REQUIRED -eq 0 ] && [ $MISSING_OPTIONAL -eq 0 ]; then
    echo -e "${GREEN}✅ All environment variables are set!${NC}"
elif [ $MISSING_REQUIRED -eq 0 ]; then
    echo -e "${GREEN}✅ All required variables are set${NC}"
    echo -e "${YELLOW}💡 Set optional variables for full functionality${NC}"
fi

echo ""

# Exit code
if [ $MISSING_REQUIRED -gt 0 ]; then
    exit 1
elif [ "$STRICT" = true ] && [ $MISSING_OPTIONAL -gt 0 ]; then
    exit 1
fi

exit 0
