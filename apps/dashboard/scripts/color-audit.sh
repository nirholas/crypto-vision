#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Color Audit Script
# 
# Scans the codebase for hardcoded colors and generates a report
# ═══════════════════════════════════════════════════════════════════════════════

set -e

CDA_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_DIR="$CDA_DIR/src"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 Color Audit Report${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Count hardcoded hex colors (excluding CSS variables file and node_modules)
echo -e "${YELLOW}📊 Hardcoded Hex Colors (#xxx)${NC}"
echo "───────────────────────────────────────────────────────────────"
HEX_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" --include="*.css" \
  -E "#[0-9a-fA-F]{3,8}" "$SRC_DIR" 2>/dev/null | \
  grep -v "globals.css" | \
  grep -v "colors.ts" | \
  grep -v "node_modules" | \
  wc -l)
echo -e "Total instances: ${RED}$HEX_COUNT${NC}"
echo ""

# Most common hardcoded patterns
echo -e "${YELLOW}🎨 Most Common Hardcoded Patterns${NC}"
echo "───────────────────────────────────────────────────────────────"

echo -e "\n${BLUE}bg-white / bg-black:${NC}"
BG_WHITE=$(grep -rn --include="*.tsx" "bg-white" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
BG_BLACK=$(grep -rn --include="*.tsx" "bg-black" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
echo "  bg-white: $BG_WHITE instances"
echo "  bg-black: $BG_BLACK instances"

echo -e "\n${BLUE}bg-gray-* / bg-neutral-*:${NC}"
BG_GRAY=$(grep -rn --include="*.tsx" -E "bg-gray-[0-9]+" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
BG_NEUTRAL=$(grep -rn --include="*.tsx" -E "bg-neutral-[0-9]+" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
echo "  bg-gray-*: $BG_GRAY instances"
echo "  bg-neutral-*: $BG_NEUTRAL instances"

echo -e "\n${BLUE}text-white / text-gray-*:${NC}"
TEXT_WHITE=$(grep -rn --include="*.tsx" "text-white" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
TEXT_GRAY=$(grep -rn --include="*.tsx" -E "text-gray-[0-9]+" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
echo "  text-white: $TEXT_WHITE instances"
echo "  text-gray-*: $TEXT_GRAY instances"

echo -e "\n${BLUE}border-gray-* / border-neutral-*:${NC}"
BORDER_GRAY=$(grep -rn --include="*.tsx" -E "border-gray-[0-9]+" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
BORDER_NEUTRAL=$(grep -rn --include="*.tsx" -E "border-neutral-[0-9]+" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
echo "  border-gray-*: $BORDER_GRAY instances"
echo "  border-neutral-*: $BORDER_NEUTRAL instances"

echo ""
echo -e "${YELLOW}📁 Files with Most Hardcoded Colors (Top 15)${NC}"
echo "───────────────────────────────────────────────────────────────"
grep -rn --include="*.tsx" -E "(bg-white|bg-black|bg-gray-|bg-neutral-|#[0-9a-fA-F]{6})" "$SRC_DIR" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "globals.css" | \
  grep -v "colors.ts" | \
  cut -d: -f1 | \
  sort | uniq -c | \
  sort -rn | \
  head -15 | \
  while read count file; do
    relative="${file#$CDA_DIR/}"
    echo -e "  ${RED}$count${NC} - $relative"
  done

echo ""
echo -e "${YELLOW}✅ Files Already Using CSS Variables${NC}"
echo "───────────────────────────────────────────────────────────────"
VAR_COUNT=$(grep -rn --include="*.tsx" "var(--" "$SRC_DIR" 2>/dev/null | grep -v "node_modules" | wc -l)
echo -e "Total CSS variable usages: ${GREEN}$VAR_COUNT${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Recommendations:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Replace bg-black with bg-background or bg-[var(--bg-primary)]"
echo "2. Replace bg-white with bg-surface or bg-[var(--surface)]"
echo "3. Replace bg-gray-* with bg-surface-* variants"
echo "4. Replace text-gray-* with text-text-secondary or text-text-muted"
echo "5. Replace border-gray-* with border-surface-border"
echo "6. Import colors from @/lib/colors.ts for chart components"
echo ""
