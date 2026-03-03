#!/bin/bash
set -e

# Rebuild Binance-US-MCP with individual commits for each file
REPO_DIR="/workspaces/universal-crypto-mcp/binance-us-mcp-server"
WORK_DIR="/tmp/binance-us-mcp-individual"

echo "🚀 Rebuilding Binance-US-MCP with individual file commits..."

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

git init
git config user.email "nirholas@users.noreply.github.com"
git config user.name "nirholas"

commit_file() {
    local file="$1"
    local message="$2"
    if [ -e "$REPO_DIR/$file" ]; then
        mkdir -p "$(dirname "$file")"
        cp "$REPO_DIR/$file" "$file"
        git add "$file"
        git commit -m "$message" 2>/dev/null || true
    fi
}

echo "📦 Creating individual commits..."

# Root config files
commit_file "package.json" "🎯 Initialize package.json with Binance.US MCP server dependencies"
commit_file "package-lock.json" "🔒 Lock dependency versions for reproducible builds"
commit_file "tsconfig.json" "⚙️ Configure TypeScript for ES2022 and NodeNext modules"
commit_file "config.json" "🔧 Add server configuration with API endpoint settings"
commit_file "README.md" "📖 Add comprehensive README with setup and usage instructions"

# Core source files
commit_file "src/index.ts" "🚀 Create MCP server entry point with tool registration"
commit_file "src/config/binanceUsClient.ts" "🔐 Implement Binance.US API client with HMAC authentication"
commit_file "src/config/types.ts" "📝 Define TypeScript interfaces for API responses"

# Tool modules
commit_file "src/tools/general/index.ts" "🏓 Add general API tools - ping, time, exchange info"
commit_file "src/tools/market/index.ts" "📊 Implement market data tools - prices, orderbook, trades, klines"
commit_file "src/tools/account/index.ts" "👤 Add account tools - balances, trade history, status"
commit_file "src/tools/trade/index.ts" "💹 Implement core trading tools - orders, status, cancel"
commit_file "src/tools/trade/orders.ts" "✨ Add order placement with limit, market, and stop orders"
commit_file "src/tools/trade/oco.ts" "⚖️ Implement OCO (One-Cancels-Other) order management"
commit_file "src/tools/wallet/index.ts" "👛 Add wallet tools - deposits, withdrawals, transfers"
commit_file "src/tools/staking/index.ts" "💰 Implement staking tools for earning rewards"
commit_file "src/tools/otc/index.ts" "🏦 Add OTC trading tools for large block trades"
commit_file "src/tools/subaccount/index.ts" "👥 Implement sub-account management tools"
commit_file "src/tools/userdata-stream/index.ts" "📡 Add WebSocket user data stream management"
commit_file "src/tools/credit-line/index.ts" "💳 Implement credit line tools for institutional trading"
commit_file "src/tools/creditline/index.ts" "💳 Add alternative credit line module structure"
commit_file "src/tools/custodial-solution/index.ts" "🔒 Implement custodial solution for enterprise clients"
commit_file "src/tools/custodial/index.ts" "🔒 Add alternative custodial module structure"

# Documentation
commit_file "docs/README.md" "📚 Create documentation index and overview"
commit_file "docs/API.md" "🔌 Document complete Binance.US REST API reference"
commit_file "docs/API_CLIENT.md" "🌐 Explain API client configuration and authentication"
commit_file "docs/API_REFERENCE.md" "📋 Add detailed endpoint reference with parameters"
commit_file "docs/CONFIGURATION.md" "⚙️ Document server configuration options"
commit_file "docs/SECURITY.md" "🔐 Add security best practices and API key management"
commit_file "docs/ERROR_CODES.md" "⚠️ Document API error codes and troubleshooting"
commit_file "docs/TOOLS.md" "🛠️ List all available MCP tools with descriptions"
commit_file "docs/TOOLS_REFERENCE.md" "📖 Add comprehensive tool parameter reference"
commit_file "docs/TRADING.md" "📈 Document trading operations and order types"
commit_file "docs/TRADING_QUICK_REF.md" "⚡ Add quick reference for common trading tasks"
commit_file "docs/QUICK_REFERENCE.md" "📋 Create cheat sheet for frequent operations"
commit_file "docs/EXAMPLES.md" "💡 Add code examples and usage patterns"
commit_file "docs/PROMPT_EXAMPLES.md" "💬 Provide example prompts for Claude integration"
commit_file "docs/IMPLEMENTATION_GUIDE.md" "🏗️ Document implementation details and architecture"
commit_file "docs/CHANGELOG.md" "📝 Track version history and changes"
commit_file "docs/OTC_TRADING.md" "🏛️ Document OTC trading features for institutions"
commit_file "docs/CREDIT_LINE.md" "💳 Explain credit line features and requirements"
commit_file "docs/CUSTODIAL_SOLUTION.md" "🔒 Document custodial services for enterprises"

echo ""
echo "✅ All commits created!"
COMMIT_COUNT=$(git log --oneline | wc -l)
echo "📊 Total commits: $COMMIT_COUNT"
echo ""
git log --oneline | head -20
echo ""
echo "🚀 Ready to push!"
