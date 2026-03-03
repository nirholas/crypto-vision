#!/bin/bash
set -e

# Rebuild Binance-MCP with curated commit history
# Each logical group gets a unique commit with emoji

REPO_DIR="/workspaces/universal-crypto-mcp/binance-mcp-server"
WORK_DIR="/tmp/binance-mcp-rebuild"
GITHUB_USER="nirholas"
REPO_NAME="Binance-MCP"

echo "🚀 Rebuilding Binance-MCP with curated history..."

# Clean and create work directory  
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Initialize fresh repo
git init
git config user.email "nirholas@users.noreply.github.com"
git config user.name "nirholas"

# Function to add files and commit
commit_files() {
    local message="$1"
    shift
    for file in "$@"; do
        if [ -e "$REPO_DIR/$file" ]; then
            mkdir -p "$(dirname "$file")"
            cp -r "$REPO_DIR/$file" "$file"
            git add "$file"
        fi
    done
    git commit -m "$message" --allow-empty 2>/dev/null || true
}

# Function to add directory and commit
commit_dir() {
    local message="$1"
    local dir="$2"
    if [ -d "$REPO_DIR/$dir" ]; then
        mkdir -p "$dir"
        cp -r "$REPO_DIR/$dir"/* "$dir/" 2>/dev/null || true
        git add "$dir"
        git commit -m "$message" 2>/dev/null || true
    fi
}

echo "📦 Creating commits..."

# === ROOT CONFIG FILES ===
commit_files "🎯 Initialize project with package configuration" "package.json"
commit_files "⚙️ Add TypeScript compiler configuration" "tsconfig.json"
commit_files "🙈 Add Git ignore patterns for build artifacts" ".gitignore"
commit_files "📖 Add comprehensive README documentation" "README.md"
commit_files "📊 Add API coverage summary and implementation status" "API_COVERAGE_SUMMARY.md"
commit_files "📚 Add Binance REST API reference documentation" "binance-us-rest-api.md"
commit_files "🔧 Add server configuration template" "config.json"

# === CORE SOURCE FILES ===
commit_files "🚀 Add main entry point and server bootstrap" "src/index.ts"
commit_files "🔌 Add Binance API client and authentication" "src/binance.ts"
commit_files "⚡ Add initialization and startup logic" "src/init.ts"

# === CONFIG ===
commit_dir "🔐 Add Binance client configuration module" "src/config"

# === SERVER INFRASTRUCTURE ===
commit_files "🏗️ Add MCP server base class and core handlers" "src/server/base.ts"
commit_files "📡 Add SSE (Server-Sent Events) transport layer" "src/server/sse.ts"
commit_files "💻 Add STDIO transport for CLI integration" "src/server/stdio.ts"

# === UTILITIES ===
commit_dir "🛠️ Add logging and utility functions" "src/utils"

# === TOOLS ===
commit_dir "🔧 Add MCP tool definitions and handlers" "src/tools"

# === TRADING MODULES ===
commit_dir "📈 Add Spot trading module - market orders and trades" "src/modules/spot"
commit_dir "📊 Add Margin trading module - leveraged positions" "src/modules/margin"
commit_dir "🔮 Add USD-M Futures module - perpetual contracts" "src/modules/futures-usdm"
commit_dir "🪙 Add COIN-M Futures module - coin-margined contracts" "src/modules/futures-coinm"
commit_dir "🎲 Add Options trading module - derivatives" "src/modules/options"

# === ALGORITHMIC TRADING ===
commit_dir "🤖 Add Algo trading module - TWAP and VP strategies" "src/modules/algo"

# === COPY TRADING ===
commit_dir "👥 Add Copy Trading module - follow lead traders" "src/modules/copy-trading"

# === EARN & STAKING ===
commit_dir "💰 Add Staking module - ETH and SOL staking" "src/modules/staking"
commit_dir "🌾 Add Simple Earn module - flexible savings" "src/modules/simple-earn"
commit_dir "📈 Add Auto-Invest module - DCA strategies" "src/modules/auto-invest"
commit_dir "🎰 Add Dual Investment module - structured products" "src/modules/dual-investment"

# === LENDING ===
commit_dir "🏦 Add VIP Loan module - institutional lending" "src/modules/vip-loan"
commit_dir "💳 Add Crypto Loans module - collateral loans" "src/modules/crypto-loans"

# === PAYMENTS & TRANSFERS ===
commit_dir "💵 Add Fiat module - deposit and withdrawal" "src/modules/fiat"
commit_dir "💸 Add Pay module - Binance Pay transactions" "src/modules/pay"
commit_dir "🔄 Add Convert module - instant crypto swaps" "src/modules/convert"
commit_dir "👤 Add C2C module - peer-to-peer trading" "src/modules/c2c"

# === WALLET & ACCOUNT ===
commit_dir "👛 Add Wallet module - balances and transfers" "src/modules/wallet"
commit_dir "📊 Add Portfolio Margin module - unified margin" "src/modules/portfolio-margin"
commit_dir "🎁 Add Rebate module - commission history" "src/modules/rebate"

# === COLLECTIBLES & GIFTS ===
commit_dir "🖼️ Add NFT module - digital collectibles" "src/modules/nft"
commit_dir "🎀 Add Gift Card module - crypto gift cards" "src/modules/gift-card"

# === MINING ===
commit_dir "⛏️ Add Mining module - pool mining stats" "src/modules/mining"

echo "✅ All commits created!"
echo ""
echo "📋 Commit history:"
git log --oneline

echo ""
echo "🚀 Ready to push. Run:"
echo "   cd $WORK_DIR"
echo "   git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
echo "   git push origin main --force"
