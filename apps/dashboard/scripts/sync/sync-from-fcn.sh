#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Sync from Free-Crypto-News (FCN) to Crypto-Data-Aggregator (CDA)
# 
# This script pulls features from FCN that are missing in CDA.
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
echo -e "${BLUE}🔄 FCN → CDA Sync Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Clone or update FCN repo
if [ -d "$TEMP_DIR" ]; then
    echo -e "${YELLOW}📥 Updating FCN repo...${NC}"
    cd "$TEMP_DIR"
    git pull --quiet
else
    echo -e "${YELLOW}📥 Cloning FCN repo...${NC}"
    git clone --depth 1 "$FCN_REPO" "$TEMP_DIR" 2>/dev/null
fi

cd "$CDA_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# SYNC OPTIONS
# ═══════════════════════════════════════════════════════════════════════════════

sync_i18n() {
    echo -e "${GREEN}📚 Syncing i18n system...${NC}"
    
    # Create directories
    mkdir -p src/i18n messages
    
    # Copy i18n config
    cp -r "$TEMP_DIR/src/i18n/"* src/i18n/
    
    # Copy message files
    cp -r "$TEMP_DIR/messages/"* messages/
    
    # Copy i18n config file
    cp "$TEMP_DIR/.i18nrc.js" ./
    
    echo -e "  ${GREEN}✓${NC} Copied src/i18n/"
    echo -e "  ${GREEN}✓${NC} Copied messages/"
    echo -e "  ${GREEN}✓${NC} Copied .i18nrc.js"
}

sync_components() {
    echo -e "${GREEN}🧩 Syncing FCN-unique components...${NC}"
    
    # Components that FCN has that CDA might not
    local fcn_components=(
        "LanguageSwitcher.tsx"
        "SourceComparison.tsx"
        "CommandPalette.tsx"
        "MobileNav.tsx"
        "InstallPrompt.tsx"
        "UpdatePrompt.tsx"
        "OfflineIndicator.tsx"
    )
    
    for comp in "${fcn_components[@]}"; do
        if [ -f "$TEMP_DIR/src/components/$comp" ]; then
            if [ ! -f "src/components/$comp" ]; then
                cp "$TEMP_DIR/src/components/$comp" src/components/
                echo -e "  ${GREEN}✓${NC} Copied $comp (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $comp (exists)"
            fi
        fi
    done
}

sync_lib() {
    echo -e "${GREEN}📦 Syncing FCN-unique lib utilities...${NC}"
    
    local fcn_libs=(
        "translate.ts"
        "international-sources.ts"
        "source-translator.ts"
        "alert-rules.ts"
    )
    
    for lib in "${fcn_libs[@]}"; do
        if [ -f "$TEMP_DIR/src/lib/$lib" ]; then
            if [ ! -f "src/lib/$lib" ]; then
                cp "$TEMP_DIR/src/lib/$lib" src/lib/
                echo -e "  ${GREEN}✓${NC} Copied $lib (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $lib (exists)"
            fi
        fi
    done
}

sync_tests() {
    echo -e "${GREEN}🧪 Syncing tests...${NC}"
    
    mkdir -p src/__tests__ e2e
    
    # Copy i18n tests
    if [ -f "$TEMP_DIR/src/__tests__/i18n.test.ts" ]; then
        cp "$TEMP_DIR/src/__tests__/i18n.test.ts" src/__tests__/
        echo -e "  ${GREEN}✓${NC} Copied i18n.test.ts"
    fi
    
    if [ -f "$TEMP_DIR/e2e/i18n.spec.ts" ]; then
        cp "$TEMP_DIR/e2e/i18n.spec.ts" e2e/
        echo -e "  ${GREEN}✓${NC} Copied e2e/i18n.spec.ts"
    fi
}

sync_scripts() {
    echo -e "${GREEN}📜 Syncing i18n scripts...${NC}"
    
    mkdir -p scripts/i18n
    
    if [ -d "$TEMP_DIR/scripts/i18n" ]; then
        cp -r "$TEMP_DIR/scripts/i18n/"* scripts/i18n/
        echo -e "  ${GREEN}✓${NC} Copied scripts/i18n/"
    fi
}

sync_readmes() {
    echo -e "${GREEN}📄 Syncing translated READMEs...${NC}"
    
    for readme in "$TEMP_DIR"/README.*.md; do
        if [ -f "$readme" ]; then
            filename=$(basename "$readme")
            if [ ! -f "$filename" ]; then
                cp "$readme" ./
                echo -e "  ${GREEN}✓${NC} Copied $filename (new)"
            else
                echo -e "  ${YELLOW}○${NC} Skipped $filename (exists)"
            fi
        fi
    done
}

sync_all() {
    sync_i18n
    sync_components
    sync_lib
    sync_tests
    sync_scripts
    sync_readmes
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all         Sync everything from FCN"
    echo "  i18n        Sync i18n system (messages, config)"
    echo "  components  Sync FCN-unique components"
    echo "  lib         Sync FCN-unique lib utilities"
    echo "  tests       Sync test files"
    echo "  scripts     Sync i18n scripts"
    echo "  readmes     Sync translated READMEs"
    echo "  compare     Show differences (dry run)"
    echo "  help        Show this help"
    echo ""
}

compare_repos() {
    echo -e "${BLUE}📊 Comparing FCN vs CDA...${NC}"
    echo ""
    
    echo -e "${YELLOW}Components only in FCN:${NC}"
    comm -23 <(find "$TEMP_DIR/src/components" -name "*.tsx" -exec basename {} \; 2>/dev/null | sort) \
             <(find "$CDA_DIR/src/components" -name "*.tsx" -exec basename {} \; 2>/dev/null | sort) | head -20
    
    echo ""
    echo -e "${YELLOW}Lib files only in FCN:${NC}"
    comm -23 <(find "$TEMP_DIR/src/lib" -name "*.ts" -exec basename {} \; 2>/dev/null | sort) \
             <(find "$CDA_DIR/src/lib" -name "*.ts" -exec basename {} \; 2>/dev/null | sort) | head -20
    
    echo ""
    echo -e "${YELLOW}API routes only in FCN:${NC}"
    comm -23 <(find "$TEMP_DIR/src/app/api" -type d -maxdepth 1 -exec basename {} \; 2>/dev/null | sort) \
             <(find "$CDA_DIR/src/app/api" -type d -maxdepth 1 -exec basename {} \; 2>/dev/null | sort) | head -20
}

case "${1:-help}" in
    all)
        sync_all
        ;;
    i18n)
        sync_i18n
        ;;
    components)
        sync_components
        ;;
    lib)
        sync_lib
        ;;
    tests)
        sync_tests
        ;;
    scripts)
        sync_scripts
        ;;
    readmes)
        sync_readmes
        ;;
    compare)
        compare_repos
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
