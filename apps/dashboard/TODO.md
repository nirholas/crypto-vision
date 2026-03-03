# TODO

## High Priority

### Website Design Issues

- [x] Fix broken links throughout the site (verified all internal links)
- [x] Fix color mismatches - ensure consistent dark theme (migrated to design tokens)
- [x] Review all pages for design consistency (completed design token migration)
- [ ] Check mobile responsiveness

### Design Token Migration (Completed ✅)

Migrated all `dark:` patterns to use CSS variable-based design tokens:
- `text-text-primary`, `text-text-secondary`, `text-text-muted` for text colors
- `bg-surface`, `bg-surface-alt`, `bg-surface-hover` for backgrounds
- `border-surface-border` for borders
- `text-gain`, `text-loss`, `text-warning` for semantic colors
- `text-primary`, `bg-primary/10` for brand colors

Files migrated:
- src/app/watchlist/page.tsx
- src/components/sidebar/ (PopularStories, TrendingNews, EditorsPicks)
- src/components/LinkPrefetch.tsx, SourceComparison.tsx, NewsletterForm.tsx
- src/components/LoadingSpinner.tsx, coin/MarketsTable.tsx
- src/app/global-error.tsx, movers/page.tsx
- src/components/alerts/PriceAlertModal.tsx, AlertsList.tsx
- src/components/ReadingAnalytics.tsx
- src/app/pricing/premium/page.tsx, upgrade/page.tsx
- src/app/markets/exchanges/page.tsx, exchanges/[id]/page.tsx
- src/app/markets/gainers/page.tsx, losers/page.tsx
- src/app/docs/api/page.tsx
- src/components/SocialBuzz.tsx, WatchlistMiniWidget.tsx, MobileNav.tsx

## Medium Priority

### Admin Dashboard

- [ ] Add revenue analytics from x402 payments
- [ ] Add export functionality for API key data

### API

- [ ] Add rate limit headers to all responses
- [ ] Improve error messages

## Low Priority

- [ ] Add more chart visualizations to admin dashboard
- [ ] Add email notifications for key expiration
