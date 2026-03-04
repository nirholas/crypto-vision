#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Sync from Crypto-Data-Aggregator (CDA) to Free-Crypto-News (FCN)
# 
# This script pushes features from CDA to FCN.
# Run from the CDA repo root directory.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
FCN_REPO="https://github.com/nirholas/free-crypto-news.git"
TEMP_DIR="/tmp/fcn-sync"
CDA_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔄 CDA → FCN Sync Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Clone or update FCN repo
if [ -d "$TEMP_DIR" ]; then
    echo -e "${YELLOW}📥 Updating FCN repo...${NC}"
    cd "$TEMP_DIR"
    git pull --quiet
else
    echo -e "${YELLOW}📥 Cloning FCN repo...${NC}"
    git clone "$FCN_REPO" "$TEMP_DIR" 2>/dev/null
fi

cd "$CDA_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# SYNC OPTIONS - Components CDA has that FCN might not
# ═══════════════════════════════════════════════════════════════════════════════

sync_components() {
    echo -e "${GREEN}🧩 Syncing CDA-unique components to FCN...${NC}"
    
    # Components that CDA has that FCN might not
    local cda_components=(
        "Heatmap.tsx"
        "LivePrice.tsx"
        "CryptoCalculator.tsx"
        "CorrelationMatrix.tsx"
        "GasTracker.tsx"
        "Screener.tsx"
        "ExportData.tsx"
        "CurrencySelector.tsx"
        "DominanceChart.tsx"
        "LiquidationsFeed.tsx"
    )
    
    for comp in "${cda_components[@]}"; do
        if [ -f "src/components/$comp" ]; then
            if [ ! -f "$TEMP_DIR/src/components/$comp" ]; then
                cp "src/components/$comp" "$TEMP_DIR/src/components/"
                echo -e "  ${GREEN}✓${NC} Copied $comp to FCN (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $comp (exists in FCN)"
            fi
        fi
    done
}

sync_lib() {
    echo -e "${GREEN}📦 Syncing CDA-unique lib utilities to FCN...${NC}"
    
    local cda_libs=(
        "admin-auth.ts"
        "price-websocket.ts"
        "external-apis.ts"
    )
    
    for lib in "${cda_libs[@]}"; do
        if [ -f "src/lib/$lib" ]; then
            if [ ! -f "$TEMP_DIR/src/lib/$lib" ]; then
                cp "src/lib/$lib" "$TEMP_DIR/src/lib/"
                echo -e "  ${GREEN}✓${NC} Copied $lib to FCN (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $lib (exists in FCN)"
            fi
        fi
    done
}

sync_pages() {
    echo -e "${GREEN}📄 Syncing CDA-unique pages to FCN...${NC}"
    
    local cda_pages=(
        "heatmap"
        "calculator"
        "correlation"
        "gas"
        "screener"
        "liquidations"
        "dominance"
    )
    
    for page in "${cda_pages[@]}"; do
        if [ -d "src/app/$page" ]; then
            if [ ! -d "$TEMP_DIR/src/app/\[locale\]/$page" ]; then
                echo -e "  ${YELLOW}!${NC} $page needs manual migration (locale structure differs)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $page (exists in FCN)"
            fi
        fi
    done
}

sync_api() {
    echo -e "${GREEN}🔌 Syncing CDA-unique API routes to FCN...${NC}"
    
    local cda_apis=(
        "register"
    )
    
    for api in "${cda_apis[@]}"; do
        if [ -d "src/app/api/$api" ]; then
            if [ ! -d "$TEMP_DIR/src/app/api/$api" ]; then
                cp -r "src/app/api/$api" "$TEMP_DIR/src/app/api/"
                echo -e "  ${GREEN}✓${NC} Copied /api/$api to FCN (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped /api/$api (exists in FCN)"
            fi
        fi
    done
}

commit_changes() {
    echo -e "${BLUE}📝 Committing changes to FCN...${NC}"
    
    cd "$TEMP_DIR"
    git add -A
    
    if git diff --staged --quiet; then
        echo -e "  ${YELLOW}○${NC} No changes to commit"
    else
        git commit -m "feat: sync components from CDA

Synced from crypto-data-aggregator:
- Components: $(git diff --staged --name-only | grep components | wc -l) files
- Lib: $(git diff --staged --name-only | grep lib | wc -l) files
- API: $(git diff --staged --name-only | grep api | wc -l) files"
        
        echo -e "  ${GREEN}✓${NC} Changes committed"
        echo -e "  ${YELLOW}!${NC} Run 'cd $TEMP_DIR && git push' to push changes"
    fi
    
    cd "$CDA_DIR"
}

sync_all() {
    sync_components
    sync_lib
    sync_api
    sync_pages
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all         Sync all CDA features to FCN"
    echo "  components  Sync CDA-unique components"
    echo "  lib         Sync CDA-unique lib utilities"
    echo "  api         Sync CDA-unique API routes"
    echo "  pages       Check page sync status"
    echo "  commit      Commit synced changes to FCN"
    echo "  push        Commit and push to FCN"
    echo "  help        Show this help"
    echo ""
}

case "${1:-help}" in
    all)
        sync_all
        ;;
    components)
        sync_components
        ;;
    lib)
        sync_lib
        ;;
    api)
        sync_api
        ;;
    pages)
        sync_pages
        ;;
    commit)
        commit_changes
        ;;
    push)
        sync_all
        commit_changes
        cd "$TEMP_DIR"
        git push
        echo -e "${GREEN}✅ Pushed to FCN!${NC}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Done!${NC}"
