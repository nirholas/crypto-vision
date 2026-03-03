#!/bin/bash

# 🧹 Sweep - LLM Documentation Fetcher
# Fetches llms.txt and llms-full.txt files from API providers

set -e

DOCS_DIR="/workspaces/sweep/docs/external"
mkdir -p "$DOCS_DIR"

echo "🧹 Sweep - Fetching LLM Documentation"
echo "==========================================="
echo ""

# Function to fetch and save documentation
fetch_doc() {
    local name=$1
    local url=$2
    local filename=$3
    
    echo -n "Fetching $name... "
    
    if curl -sfL --max-time 30 "$url" -o "$DOCS_DIR/$filename" 2>/dev/null; then
        size=$(wc -c < "$DOCS_DIR/$filename")
        if [ "$size" -gt 100 ]; then
            echo "✅ ($size bytes)"
            return 0
        else
            echo "⚠️ (too small, likely 404)"
            rm -f "$DOCS_DIR/$filename"
            return 1
        fi
    else
        echo "❌ (failed)"
        rm -f "$DOCS_DIR/$filename"
        return 1
    fi
}

# Track results
SUCCESS=0
FAILED=0

echo "📦 Priority 1 - Core APIs"
echo "-------------------------"

# Confirmed working
fetch_doc "x402 Protocol" "https://www.x402.org/llms-full.txt" "x402-llms-full.txt" && ((SUCCESS++)) || ((FAILED++))

# Standard locations to try
fetch_doc "viem" "https://viem.sh/llms.txt" "viem-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "wagmi" "https://wagmi.sh/llms.txt" "wagmi-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Pimlico" "https://docs.pimlico.io/llms.txt" "pimlico-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Pimlico (full)" "https://docs.pimlico.io/llms-full.txt" "pimlico-llms-full.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🔄 DEX Aggregators"
echo "------------------"

fetch_doc "1inch" "https://1inch.dev/llms.txt" "1inch-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "1inch Portal" "https://portal.1inch.dev/llms.txt" "1inch-portal-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Jupiter" "https://station.jup.ag/llms.txt" "jupiter-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Jupiter (docs)" "https://docs.jup.ag/llms.txt" "jupiter-docs-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "CoW Protocol" "https://docs.cow.fi/llms.txt" "cow-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Li.Fi" "https://docs.li.fi/llms.txt" "lifi-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Li.Fi (full)" "https://docs.li.fi/llms-full.txt" "lifi-llms-full.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Paraswap" "https://developers.paraswap.network/llms.txt" "paraswap-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "0x" "https://0x.org/docs/llms.txt" "0x-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🌉 Cross-Chain Bridges"
echo "----------------------"

fetch_doc "Across" "https://docs.across.to/llms.txt" "across-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "deBridge" "https://docs.debridge.finance/llms.txt" "debridge-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Socket" "https://docs.socket.tech/llms.txt" "socket-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Wormhole" "https://docs.wormhole.com/llms.txt" "wormhole-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🔐 Account Abstraction"
echo "----------------------"

fetch_doc "Alchemy AA" "https://accountkit.alchemy.com/llms.txt" "alchemy-aa-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Biconomy" "https://docs.biconomy.io/llms.txt" "biconomy-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "ZeroDev" "https://docs.zerodev.app/llms.txt" "zerodev-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Safe" "https://docs.safe.global/llms.txt" "safe-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "📇 Wallet Indexing"
echo "------------------"

fetch_doc "Alchemy" "https://docs.alchemy.com/llms.txt" "alchemy-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Helius" "https://docs.helius.dev/llms.txt" "helius-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Moralis" "https://docs.moralis.io/llms.txt" "moralis-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Covalent" "https://www.covalenthq.com/docs/llms.txt" "covalent-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "💰 Price & Market Data"
echo "----------------------"

fetch_doc "CoinGecko" "https://docs.coingecko.com/llms.txt" "coingecko-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "CoinGecko (api)" "https://www.coingecko.com/api/llms.txt" "coingecko-api-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "DeFi Llama" "https://defillama.com/llms.txt" "defillama-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Chainlink" "https://docs.chain.link/llms.txt" "chainlink-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Pyth" "https://docs.pyth.network/llms.txt" "pyth-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🏦 DeFi Protocols"
echo "-----------------"

fetch_doc "Aave" "https://docs.aave.com/llms.txt" "aave-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Aave (hub)" "https://aave.com/llms.txt" "aave-hub-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Yearn" "https://docs.yearn.fi/llms.txt" "yearn-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Beefy" "https://docs.beefy.finance/llms.txt" "beefy-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Compound" "https://docs.compound.finance/llms.txt" "compound-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Lido" "https://docs.lido.fi/llms.txt" "lido-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Rocket Pool" "https://docs.rocketpool.net/llms.txt" "rocketpool-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Jito" "https://docs.jito.network/llms.txt" "jito-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Marinade" "https://docs.marinade.finance/llms.txt" "marinade-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Pendle" "https://docs.pendle.finance/llms.txt" "pendle-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Eigenlayer" "https://docs.eigenlayer.xyz/llms.txt" "eigenlayer-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🌐 RPC & Infrastructure"
echo "-----------------------"

fetch_doc "QuickNode" "https://www.quicknode.com/docs/llms.txt" "quicknode-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Infura" "https://docs.infura.io/llms.txt" "infura-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Chainstack" "https://docs.chainstack.com/llms.txt" "chainstack-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Tenderly" "https://docs.tenderly.co/llms.txt" "tenderly-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🔑 Auth & Identity"
echo "------------------"

fetch_doc "SIWE" "https://docs.login.xyz/llms.txt" "siwe-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "SIWE (login)" "https://login.xyz/llms.txt" "siwe-login-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Privy" "https://docs.privy.io/llms.txt" "privy-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Dynamic" "https://docs.dynamic.xyz/llms.txt" "dynamic-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Web3Auth" "https://web3auth.io/docs/llms.txt" "web3auth-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "📈 Analytics"
echo "------------"

fetch_doc "Dune" "https://docs.dune.com/llms.txt" "dune-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Transpose" "https://docs.transpose.io/llms.txt" "transpose-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🛠️ Development Tools"
echo "---------------------"

fetch_doc "ethers.js" "https://docs.ethers.org/llms.txt" "ethers-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Foundry" "https://book.getfoundry.sh/llms.txt" "foundry-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Hardhat" "https://hardhat.org/docs/llms.txt" "hardhat-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "💳 Payments"
echo "-----------"

fetch_doc "Request Network" "https://docs.request.network/llms.txt" "request-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Superfluid" "https://docs.superfluid.finance/llms.txt" "superfluid-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "🔷 Coinbase Ecosystem"
echo "---------------------"

fetch_doc "Coinbase Cloud" "https://docs.cloud.coinbase.com/llms.txt" "coinbase-cloud-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Coinbase CDP" "https://docs.cdp.coinbase.com/llms.txt" "coinbase-cdp-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "Base" "https://docs.base.org/llms.txt" "base-llms.txt" && ((SUCCESS++)) || ((FAILED++))
fetch_doc "OnchainKit" "https://onchainkit.xyz/llms.txt" "onchainkit-llms.txt" && ((SUCCESS++)) || ((FAILED++))

echo ""
echo "==========================================="
echo "📊 RESULTS"
echo "==========================================="
echo "✅ Successfully fetched: $SUCCESS"
echo "❌ Failed/Not found: $FAILED"
echo ""
echo "📁 Documentation saved to: $DOCS_DIR"
echo ""

# List what we got
echo "📄 Files downloaded:"
ls -la "$DOCS_DIR"/*.txt 2>/dev/null | awk '{print "   " $NF " (" $5 " bytes)"}' || echo "   (none)"

echo ""
echo "🔍 APIs without llms.txt (need manual documentation):"
echo "   - 1inch (use OpenAPI spec at https://1inch.dev/api)"
echo "   - Jupiter (use API docs at https://station.jup.ag/docs/apis)"
echo "   - Coinbase (use https://docs.cloud.coinbase.com)"
echo "   - Alchemy (use https://docs.alchemy.com/reference)"
echo ""
echo "💡 Tip: For APIs without llms.txt, copy their OpenAPI/Swagger specs instead"
