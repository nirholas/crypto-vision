# Prompt 05 — Dashboard Admin, Settings, PWA & Polish

## Context

You are working on `crypto-vision` dashboard (`apps/dashboard/`, Next.js 15). The app has existing admin, settings, auth, and PWA infrastructure:

- `apps/dashboard/src/app/admin/` — Admin dashboard pages
- `apps/dashboard/src/app/auth/` — Authentication pages
- `apps/dashboard/src/app/settings/` — Settings pages
- `apps/dashboard/src/app/pricing/` — Pricing/premium pages
- `apps/dashboard/src/lib/admin-auth.ts` — Admin authentication
- `apps/dashboard/src/lib/premium.ts` — Premium feature management
- `apps/dashboard/src/lib/x402-payments.ts` — x402 micropayments
- `apps/dashboard/src/components/admin/` — Admin components
- `apps/dashboard/src/components/auth/` — Auth components
- `apps/dashboard/src/components/x402/` — Payment components
- PWA manifest and service worker configured

## Task

### 1. Redesign Admin Dashboard (`/admin`)

Professional admin panel with:

**Overview Dashboard:**
- API request count (today, 7d, 30d) with chart
- Active API keys count
- Revenue from x402 payments (if applicable)
- Error rate and top errors
- System health: API status, Redis status, DB status
- Top endpoints by usage

**API Key Management (`/admin/keys`):**
- Table of all API keys: name, key (masked), created, last used, requests count, rate limit, status
- Create new key form: name, rate limit tier, description
- Revoke/rotate key actions
- Usage chart per key

**User Management (placeholder):**
- User list with activity stats
- Premium status indicators

### 2. Redesign Settings Page (`/settings`)

**Appearance:**
- Theme: Dark (default, only option — remove light mode entirely)
- Accent color picker (teal, purple, blue, orange, red)
- Number format: 1,234.56 vs 1.234,56
- Compact mode toggle (denser UI)

**Currency:**
- Default currency: USD, EUR, GBP, JPY, BTC, ETH
- Keep existing `CurrencyProvider`

**Notifications:**
- Browser push notification toggle
- Alert sound toggle
- Email notifications (placeholder)

**Data:**
- Clear local data button
- Export all data (portfolio + watchlist + settings) as JSON
- Import data from JSON
- Cache management: clear API cache

**API Configuration:**
- Backend API URL (default: http://localhost:8080)
- Swarm API URL (default: http://localhost:3847)
- CoinGecko API key (optional)
- Auto-refresh interval (30s, 60s, 120s, 5m, off)

**Keyboard Shortcuts:**
- Display all keyboard shortcuts
- Customizable (optional)

### 3. PWA Improvements

- Update manifest.json with new app name and colors matching design system
- App icon (generate simple SVG icon with the letters "CV" in accent color)
- Offline page: styled message with last-known portfolio value
- Install prompt: subtle banner at top on first visit
- Background sync for portfolio data

### 4. Global Polish

**Loading States:**
- Global loading bar at top of page (thin accent-colored line)
- Page transition animations (fade in)
- Skeleton screens for every page

**Error Handling:**
- Custom error page (`error.tsx`) — styled with design system
- 404 page — styled, with search and popular links
- Rate limit page — "Data refreshing..." with countdown
- Network error — offline indicator in top bar

**Keyboard Shortcuts:**
- `Cmd/Ctrl + K` — Global search
- `Cmd/Ctrl + /` — Show shortcuts
- `1-9` — Navigate to sidebar items
- `Esc` — Close modals/overlays

**Toasts:**
- Positioned bottom-right
- Types: success (green), error (red), info (blue), warning (yellow)
- Auto-dismiss after 5s
- Stack up to 3 simultaneously

**Accessibility:**
- Focus rings on all interactive elements
- ARIA labels on icon buttons
- Skip-to-content link
- Reduced motion support via `prefers-reduced-motion`

### 5. SEO & Meta

- Update all page metadata with proper titles and descriptions
- OG image generation (keep existing `/api/og` route)
- Sitemap updates
- robots.txt

### 6. Performance

- Lazy load heavy components (charts, tables with 100+ rows)
- Image optimization via Next.js Image
- Font subsetting (Inter + JetBrains Mono, only needed weights)
- Bundle analysis: `npm run analyze`

## Technical Requirements

- No light mode — dark only
- All settings persisted in localStorage
- Settings sync between tabs via `BroadcastChannel` or `storage` event
- No `any` types
- Keep all existing provider logic
- Mobile responsive

## Files to Modify/Create

- `apps/dashboard/src/app/admin/` — Redesign all admin pages
- `apps/dashboard/src/app/settings/page.tsx` — Redesign
- `apps/dashboard/src/app/error.tsx` — Restyle
- `apps/dashboard/src/app/not-found.tsx` — Create/restyle
- `apps/dashboard/src/app/loading.tsx` — Restyle
- `apps/dashboard/src/components/Toast.tsx` — Create/restyle
- `apps/dashboard/public/manifest.json` — Update
- `apps/dashboard/src/app/offline/page.tsx` — Restyle

## Verification

1. Admin dashboard loads with mock stats
2. Settings page saves preferences to localStorage
3. Keyboard shortcuts work globally
4. Error and 404 pages display styled content
5. Toast notifications appear and auto-dismiss
6. PWA installable with correct icon and colors
7. No TypeScript errors
