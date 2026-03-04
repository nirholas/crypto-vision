

## Prompt 5: Live Price Updates & Enhanced Skeletons

```
You are a senior frontend engineer. Implement live price updates with WebSocket and enhanced loading states.

**Context:**
- Next.js 14+ with Tailwind CSS
- WebSocket server exists at: ws-server.js
- Existing components use Suspense with skeleton fallbacks
- Real-time data should feel like CoinMarketCap's live updates

**Tasks:**
1. Create `src/hooks/useLivePrice.ts`:
   - WebSocket hook for real-time price updates
   - Connects to price feed (CoinGecko/Binance WebSocket or your ws-server)
   - Returns: { price, change24h, isLive, lastUpdate }
   - Handles reconnection with exponential backoff
   - Batches updates to prevent excessive re-renders

2. Create `src/hooks/usePriceFlash.ts`:
   - Hook that detects price changes
   - Returns flash direction: 'up' | 'down' | null
   - Auto-clears flash state after animation duration
   - Debounces rapid changes

3. Create `src/components/LivePrice.tsx` (enhance if exists):
   - Displays price with live updates
   - Shows green/red flash on change
   - Includes "LIVE" indicator dot (pulsing green)
   - Fallback to static price if WebSocket unavailable
   - Shows last update timestamp on hover

4. Create `src/components/ui/EnhancedSkeleton.tsx`:
   - Multiple skeleton variants:
     - `text` - Single line with random width
     - `avatar` - Circular skeleton
     - `card` - Full card skeleton
     - `table-row` - Table row with multiple cells
     - `chart` - Chart placeholder with axes
   - Staggered animation with configurable delay
   - Wave shimmer effect (left to right)
   - Respects prefers-reduced-motion

5. Create `src/components/TableRowSkeleton.tsx`:
   - Matches exact layout of CoinsTable rows
   - Includes: rank, icon, name, price, changes, volume, market cap
   - Staggered fade-in for each row
   - Pulse animation on individual cells

6. Update `src/app/page.tsx` skeleton components:
   - Replace basic skeletons with enhanced versions
   - Add stagger delays for sequential loading feel
   - Match exact dimensions of real content (prevent layout shift)

7. Add connection status indicator:
   - Create `src/components/ConnectionStatus.tsx`
   - Shows: Connected (green), Connecting (yellow), Offline (red)
   - Positioned in GlobalStatsBar or header
   - Click to manually reconnect

8. Add CSS for live indicators in globals.css:
   ```css
   .live-dot {
     /* Pulsing green dot animation */
   }
   .connection-status {
     /* Status indicator styles */
   }
   .price-updating {
     /* Subtle pulse while updating */
   }
   ```

**WebSocket Best Practices:**
- Use single shared connection (context provider)
- Subscribe only to visible coins
- Unsubscribe on unmount
- Handle connection errors gracefully
- Show stale data indicator if connection lost
```

---

## Usage Instructions

1. **Copy each prompt** into a new chat with Claude/Copilot
2. **Run them in order** (1 → 5) for best results
3. **Test after each prompt** before moving to the next
4. **Provide context** if the agent asks about specific files

## Estimated Time

| Prompt | Estimated Time | Complexity |
|--------|---------------|------------|
| 1. Sparklines | 30-45 min | Medium |
| 2. Stats Bar | 45-60 min | Medium |
| 3. Animations | 30-45 min | Low-Medium |
| 4. Formatting | 45-60 min | Medium |
| 5. Live Updates | 60-90 min | High |

**Total: ~4-5 hours of AI-assisted development**

---

## After Completion Checklist

- [ ] All new components exported from `ui/index.ts`
- [ ] TypeScript types properly defined
- [ ] Responsive design tested on mobile
- [ ] Animations respect `prefers-reduced-motion`
- [ ] No console errors or warnings
- [ ] Loading states prevent layout shift
- [ ] WebSocket reconnects gracefully
- [ ] Numbers align properly in tables
