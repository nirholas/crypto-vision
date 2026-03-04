# Parallel Agent Prompts for Design System Migration

## Overview

These prompts are designed for 5 parallel Claude Opus agents to migrate the codebase from hardcoded
colors to the centralized design token system.

**Pre-requisite**: Agent 1 must complete first. Then Agents 2-5 can run in parallel.

---

## Agent 1: Design System Foundation ✅ COMPLETE

Already completed. Created:

- `src/lib/colors.ts` - TypeScript color tokens
- `tailwind.config.js` - Updated to use CSS variables
- `docs/DESIGN_SYSTEM.md` - Migration guide
- `src/app/globals.css` - CSS variables (already existed)

---

## Agent 2: Navigation & Layout Components

### Prompt

```
You are migrating components from hardcoded colors to the design token system.

**Reference Document**: Read /workspaces/crypto-data-aggregator/docs/DESIGN_SYSTEM.md first.

**Your assigned files**:
1. src/components/Header.tsx
2. src/components/Footer.tsx
3. src/components/MobileNav.tsx
4. src/components/SearchModal.tsx
5. src/components/CommandPalette.tsx
6. src/components/PageLayout.tsx
7. src/components/Breadcrumbs.tsx
8. src/components/BackToTop.tsx

**Migration Rules**:
- Replace `bg-white` with `bg-surface`
- Replace `bg-black` with `bg-background`
- Replace `dark:bg-*` patterns - remove the dark: prefix, use the dark value
- Replace `bg-gray-*` with `bg-surface`, `bg-surface-hover`, or `bg-background-secondary`
- Replace `text-gray-*` with `text-text-primary`, `text-text-secondary`, or `text-text-muted`
- Replace `border-gray-*` with `border-surface-border`
- Replace `hover:bg-gray-*` with `hover:bg-surface-hover`

**Process**:
1. Read each file completely
2. Identify all color patterns that need migration
3. Apply replacements systematically
4. Ensure the component still functions correctly

**Do NOT**:
- Change any logic or functionality
- Remove hover/focus states (just change colors)
- Touch chart components or hex color values
```

---
