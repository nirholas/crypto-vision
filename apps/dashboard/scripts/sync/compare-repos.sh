#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Compare Free-Crypto-News (FCN) and Crypto-Data-Aggregator (CDA)
# 
# Shows what features each repo has that the other doesn't.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

FCN_REPO="https://github.com/nirholas/free-crypto-news.git"
TEMP_DIR="/tmp/fcn-sync"
CDA_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 FCN ↔ CDA Repository Comparison${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Clone/update FCN
if [ -d "$TEMP_DIR" ]; then
    echo -e "${YELLOW}📥 Updating FCN repo...${NC}"
    cd "$TEMP_DIR" && git pull --quiet 2>/dev/null || true
else
    echo -e "${YELLOW}📥 Cloning FCN repo...${NC}"
    git clone --depth 1 "$FCN_REPO" "$TEMP_DIR" 2>/dev/null
fi

cd "$CDA_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# COMPONENTS COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}🧩 COMPONENTS${NC}"
echo -e "───────────────────────────────────────────────────────────────"

FCN_COMPS=$(find "$TEMP_DIR/src/components" -name "*.tsx" -exec basename {} \; 2>/dev/null | sort)
CDA_COMPS=$(find "$CDA_DIR/src/components" -name "*.tsx" -exec basename {} \; 2>/dev/null | sort)

echo -e "${GREEN}Only in FCN (port to CDA):${NC}"
comm -23 <(echo "$FCN_COMPS") <(echo "$CDA_COMPS") | while read comp; do
    [ -n "$comp" ] && echo -e "  ✚ $comp"
done

echo ""
echo -e "${YELLOW}Only in CDA (port to FCN):${NC}"
comm -13 <(echo "$FCN_COMPS") <(echo "$CDA_COMPS") | while read comp; do
    [ -n "$comp" ] && echo -e "  ✚ $comp"
done

# ═══════════════════════════════════════════════════════════════════════════════
# LIB COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}📦 LIB UTILITIES${NC}"
echo -e "───────────────────────────────────────────────────────────────"

FCN_LIBS=$(find "$TEMP_DIR/src/lib" -name "*.ts" -exec basename {} \; 2>/dev/null | sort)
CDA_LIBS=$(find "$CDA_DIR/src/lib" -name "*.ts" -exec basename {} \; 2>/dev/null | sort)

echo -e "${GREEN}Only in FCN:${NC}"
comm -23 <(echo "$FCN_LIBS") <(echo "$CDA_LIBS") | while read lib; do
    [ -n "$lib" ] && echo -e "  ✚ $lib"
done

echo ""
echo -e "${YELLOW}Only in CDA:${NC}"
comm -13 <(echo "$FCN_LIBS") <(echo "$CDA_LIBS") | while read lib; do
    [ -n "$lib" ] && echo -e "  ✚ $lib"
done

# ═══════════════════════════════════════════════════════════════════════════════
# API ROUTES COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}🔌 API ROUTES${NC}"
echo -e "───────────────────────────────────────────────────────────────"

FCN_APIS=$(find "$TEMP_DIR/src/app/api" -type d -maxdepth 1 -exec basename {} \; 2>/dev/null | grep -v "^api$" | sort)
CDA_APIS=$(find "$CDA_DIR/src/app/api" -type d -maxdepth 1 -exec basename {} \; 2>/dev/null | grep -v "^api$" | sort)

echo -e "${GREEN}Only in FCN:${NC}"
comm -23 <(echo "$FCN_APIS") <(echo "$CDA_APIS") | while read api; do
    [ -n "$api" ] && echo -e "  ✚ /api/$api"
done

echo ""
echo -e "${YELLOW}Only in CDA:${NC}"
comm -13 <(echo "$FCN_APIS") <(echo "$CDA_APIS") | while read api; do
    [ -n "$api" ] && echo -e "  ✚ /api/$api"
done

# ═══════════════════════════════════════════════════════════════════════════════
# PAGES COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}📄 PAGES${NC}"
echo -e "───────────────────────────────────────────────────────────────"

# FCN uses [locale] folder structure, CDA doesn't
FCN_PAGES=$(find "$TEMP_DIR/src/app" -maxdepth 2 -type d -name "page.tsx" -exec dirname {} \; 2>/dev/null | sed "s|$TEMP_DIR/src/app/||" | sed 's|\[locale\]/||' | sort -u)
CDA_PAGES=$(find "$CDA_DIR/src/app" -maxdepth 2 -type d -exec basename {} \; 2>/dev/null | sort -u)

echo -e "${BLUE}FCN has i18n folder structure ([locale]/...)${NC}"
echo -e "${BLUE}CDA has flat folder structure${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# I18N STATUS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}🌍 I18N STATUS${NC}"
echo -e "───────────────────────────────────────────────────────────────"

FCN_MESSAGES=$(ls "$TEMP_DIR/messages/"*.json 2>/dev/null | wc -l)
CDA_MESSAGES=$(ls "$CDA_DIR/messages/"*.json 2>/dev/null | wc -l)

echo -e "FCN message files: ${GREEN}$FCN_MESSAGES${NC}"
echo -e "CDA message files: ${YELLOW}$CDA_MESSAGES${NC}"

if [ -d "$CDA_DIR/src/i18n" ]; then
    echo -e "CDA i18n folder: ${GREEN}✓ exists${NC}"
else
    echo -e "CDA i18n folder: ${RED}✗ missing${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

FCN_ONLY_COMPS=$(comm -23 <(echo "$FCN_COMPS") <(echo "$CDA_COMPS") | wc -l)
CDA_ONLY_COMPS=$(comm -13 <(echo "$FCN_COMPS") <(echo "$CDA_COMPS") | wc -l)
FCN_ONLY_LIBS=$(comm -23 <(echo "$FCN_LIBS") <(echo "$CDA_LIBS") | wc -l)
CDA_ONLY_LIBS=$(comm -13 <(echo "$FCN_LIBS") <(echo "$CDA_LIBS") | wc -l)

echo ""
echo -e "  FCN-unique components: ${GREEN}$FCN_ONLY_COMPS${NC}"
echo -e "  CDA-unique components: ${YELLOW}$CDA_ONLY_COMPS${NC}"
echo -e "  FCN-unique libs:       ${GREEN}$FCN_ONLY_LIBS${NC}"
echo -e "  CDA-unique libs:       ${YELLOW}$CDA_ONLY_LIBS${NC}"
echo ""
echo -e "Run ${CYAN}./scripts/sync/sync-from-fcn.sh all${NC} to sync FCN → CDA"
echo -e "Run ${CYAN}./scripts/sync/sync-to-fcn.sh all${NC} to sync CDA → FCN"
echo ""
