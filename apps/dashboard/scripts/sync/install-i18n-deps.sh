#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Install i18n Dependencies
# 
# Installs the required packages for internationalization.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "📦 Installing i18n dependencies..."

# Check if npm or pnpm
if command -v pnpm &> /dev/null; then
    PKG_MGR="pnpm"
elif command -v npm &> /dev/null; then
    PKG_MGR="npm"
else
    echo "❌ No package manager found (npm or pnpm)"
    exit 1
fi

echo "Using $PKG_MGR"

# Install next-intl (the main i18n library used by FCN)
$PKG_MGR install next-intl

echo ""
echo "✅ Done! Dependencies installed:"
echo "  - next-intl"
echo ""
echo "Next steps:"
echo "  1. Run ./scripts/sync/sync-from-fcn.sh i18n"
echo "  2. Update next.config.js to include i18n plugin"
echo "  3. Restructure src/app/ to src/app/[locale]/"
echo ""
