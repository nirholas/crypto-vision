#!/bin/bash

# =============================================================================
# Crypto Data Aggregator - Seed Data Script
# =============================================================================
# This script populates the application with sample data for development.
# Usage: ./scripts/seed-data.sh
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
SEED="🌱"
COIN="🪙"
CHART="📊"
FOLDER="📁"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        ${SEED} Crypto Data Aggregator - Seed Data ${SEED}            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Create data directories
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${FOLDER} Creating data directories...${NC}"

DATA_DIR="./data"
SAMPLE_DIR="$DATA_DIR/sample"

mkdir -p "$SAMPLE_DIR"

echo -e "${GREEN}${CHECK} Data directories created${NC}"
echo ""

# -----------------------------------------------------------------------------
# Generate sample portfolio data
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${COIN} Generating sample portfolio data...${NC}"

cat > "$SAMPLE_DIR/portfolio.json" << 'EOF'
{
  "holdings": [
    {
      "coinId": "bitcoin",
      "symbol": "BTC",
      "name": "Bitcoin",
      "amount": 0.5,
      "averagePrice": 42000,
      "notes": "Long-term hold"
    },
    {
      "coinId": "ethereum",
      "symbol": "ETH",
      "name": "Ethereum",
      "amount": 5.0,
      "averagePrice": 2200,
      "notes": "Staking candidate"
    },
    {
      "coinId": "solana",
      "symbol": "SOL",
      "name": "Solana",
      "amount": 25,
      "averagePrice": 95,
      "notes": "DeFi exploration"
    },
    {
      "coinId": "cardano",
      "symbol": "ADA",
      "name": "Cardano",
      "amount": 1000,
      "averagePrice": 0.45,
      "notes": "Staking rewards"
    },
    {
      "coinId": "polkadot",
      "symbol": "DOT",
      "name": "Polkadot",
      "amount": 50,
      "averagePrice": 7.5,
      "notes": "Parachain ecosystem"
    }
  ],
  "transactions": [
    {
      "id": "tx-001",
      "type": "buy",
      "coinId": "bitcoin",
      "amount": 0.25,
      "price": 40000,
      "date": "2025-01-01T10:00:00Z",
      "fee": 10
    },
    {
      "id": "tx-002",
      "type": "buy",
      "coinId": "bitcoin",
      "amount": 0.25,
      "price": 44000,
      "date": "2025-01-10T14:30:00Z",
      "fee": 12
    },
    {
      "id": "tx-003",
      "type": "buy",
      "coinId": "ethereum",
      "amount": 3.0,
      "price": 2100,
      "date": "2025-01-05T09:00:00Z",
      "fee": 8
    },
    {
      "id": "tx-004",
      "type": "buy",
      "coinId": "ethereum",
      "amount": 2.0,
      "price": 2350,
      "date": "2025-01-15T16:45:00Z",
      "fee": 6
    },
    {
      "id": "tx-005",
      "type": "buy",
      "coinId": "solana",
      "amount": 25,
      "price": 95,
      "date": "2025-01-08T11:20:00Z",
      "fee": 5
    }
  ],
  "lastUpdated": "2025-01-22T00:00:00Z"
}
EOF

echo -e "${GREEN}${CHECK} Portfolio data created${NC}"

# -----------------------------------------------------------------------------
# Generate sample watchlist data
# -----------------------------------------------------------------------------
echo -e "${YELLOW}${CHART} Generating sample watchlist data...${NC}"

cat > "$SAMPLE_DIR/watchlist.json" << 'EOF'
{
  "watchlists": [
    {
      "id": "default",
      "name": "My Watchlist",
      "coins": ["bitcoin", "ethereum", "solana", "cardano", "polkadot"],
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "defi",
      "name": "DeFi Tokens",
      "coins": ["uniswap", "aave", "compound-governance-token", "maker", "curve-dao-token"],
      "createdAt": "2025-01-05T00:00:00Z"
    },
    {
      "id": "layer2",
      "name": "Layer 2 Solutions",
      "coins": ["matic-network", "arbitrum", "optimism", "starknet", "immutable-x"],
      "createdAt": "2025-01-10T00:00:00Z"
    },
    {
      "id": "meme",
      "name": "Meme Coins",
      "coins": ["dogecoin", "shiba-inu", "pepe", "floki", "bonk"],
      "createdAt": "2025-01-12T00:00:00Z"
    }
  ],
  "lastUpdated": "2025-01-22T00:00:00Z"
}
EOF

echo -e "${GREEN}${CHECK} Watchlist data created${NC}"

# -----------------------------------------------------------------------------
# Generate sample alerts data
# -----------------------------------------------------------------------------
echo -e "${YELLOW}🔔 Generating sample alerts data...${NC}"

cat > "$SAMPLE_DIR/alerts.json" << 'EOF'
{
  "alerts": [
    {
      "id": "alert-001",
      "coinId": "bitcoin",
      "type": "price_above",
      "targetPrice": 100000,
      "enabled": true,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "alert-002",
      "coinId": "bitcoin",
      "type": "price_below",
      "targetPrice": 80000,
      "enabled": true,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "alert-003",
      "coinId": "ethereum",
      "type": "price_above",
      "targetPrice": 5000,
      "enabled": true,
      "createdAt": "2025-01-05T00:00:00Z"
    },
    {
      "id": "alert-004",
      "coinId": "solana",
      "type": "percent_change",
      "percentChange": 10,
      "timeframe": "24h",
      "enabled": true,
      "createdAt": "2025-01-08T00:00:00Z"
    }
  ],
  "lastUpdated": "2025-01-22T00:00:00Z"
}
EOF

echo -e "${GREEN}${CHECK} Alerts data created${NC}"

# -----------------------------------------------------------------------------
# Generate sample news bookmarks
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📰 Generating sample bookmarks data...${NC}"

cat > "$SAMPLE_DIR/bookmarks.json" << 'EOF'
{
  "bookmarks": [
    {
      "id": "article-001",
      "title": "Bitcoin Breaks New All-Time High",
      "url": "https://example.com/bitcoin-ath",
      "source": "CryptoNews",
      "savedAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": "article-002",
      "title": "Ethereum 2.0 Staking Rewards Explained",
      "url": "https://example.com/eth-staking",
      "source": "DeFi Daily",
      "savedAt": "2025-01-12T14:30:00Z"
    },
    {
      "id": "article-003",
      "title": "Understanding DeFi Yield Farming",
      "url": "https://example.com/yield-farming",
      "source": "Crypto Academy",
      "savedAt": "2025-01-10T09:15:00Z"
    }
  ],
  "lastUpdated": "2025-01-22T00:00:00Z"
}
EOF

echo -e "${GREEN}${CHECK} Bookmarks data created${NC}"

echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ${CHECK} Seed Data Complete! ${CHECK}                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Sample data created in:${NC} ${YELLOW}$SAMPLE_DIR${NC}"
echo ""
echo -e "  ${BLUE}Files generated:${NC}"
echo -e "    ${COIN} portfolio.json    - Sample portfolio with 5 holdings"
echo -e "    ${CHART} watchlist.json    - 4 sample watchlists"
echo -e "    🔔 alerts.json        - 4 sample price alerts"
echo -e "    📰 bookmarks.json     - 3 sample article bookmarks"
echo ""
echo -e "  ${BLUE}Note:${NC} This data is for development purposes only."
echo -e "  The application uses localStorage by default."
echo -e "  You can import this sample data via the app settings."
echo ""
