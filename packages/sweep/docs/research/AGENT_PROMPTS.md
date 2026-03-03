

## Agent 5: Frontend Completion & Production Polish

### Context
You are working on **Sweep**, a multi-chain dust sweeper with a Next.js 14 frontend at `frontend/`. The basic UI exists but needs completion and production polish.

### Your Task
Complete the **frontend application** with all features, improve UX, and prepare for production deployment.

### Files to Study First
```
frontend/app/                          # Next.js App Router pages
frontend/components/                   # React components
frontend/hooks/                        # Custom hooks
frontend/lib/wagmi.ts                  # Wallet connection config
frontend/lib/api.ts                    # API client
docs/architecture/SYSTEM_ARCHITECTURE.md
```

### Specific Deliverables

1. **Complete Dashboard Page `frontend/app/dashboard/page.tsx`**
   - Portfolio overview across all chains
   - Total dust value with breakdown
   - Quick actions: Sweep All, Consolidate
   - Recent activity feed

2. **Create Consolidation Flow `frontend/app/consolidate/page.tsx`**
   - Multi-chain source selector
   - Destination chain/token picker
   - Fee breakdown visualization
   - Progress tracker during execution

3. **Complete DeFi Page `frontend/app/defi/page.tsx`**
   - Show available DeFi destinations
   - APY comparison table
   - One-click deposit from sweep
   - Position tracking

4. **Create Subscriptions Page `frontend/app/subscriptions/page.tsx`**
   - Create/manage auto-sweep subscriptions
   - Spend permission signing flow
   - Subscription history
   - Pause/resume controls

5. **Improve Components**
   - `components/ChainSelector.tsx` - Multi-select for consolidation
   - `components/TransactionStatus.tsx` - Real-time status updates
   - `components/FeeBreakdown.tsx` - Detailed fee visualization
   - `components/DeFiVaultCard.tsx` - Vault selection cards

6. **Add Hooks**
   - `hooks/useConsolidation.ts` - Consolidation flow state
   - `hooks/useSubscriptions.ts` - Subscription management
   - `hooks/useMultiChainBalance.ts` - Aggregate balances
   - `hooks/useTransactionStatus.ts` - WebSocket status updates

7. **Create WebSocket Connection `frontend/lib/websocket.ts`**
   - Real-time transaction status
   - Price updates
   - Subscription triggers

8. **Add Error Handling**
   - User-friendly error messages
   - Retry mechanisms
   - Fallback states

9. **Production Optimizations**
   - Loading skeletons (expand `Skeletons.tsx`)
   - Optimistic updates
   - Request deduplication
   - Image optimization

10. **Add E2E Tests `frontend/tests/e2e/`**
    - Wallet connection flow
    - Dust sweep flow
    - Consolidation flow

### Technical Requirements
- Use wagmi v2 + viem for wallet connection
- TanStack Query for API state
- Tailwind CSS for styling
- Support: MetaMask, Coinbase Wallet, WalletConnect, Phantom (Solana)
- Mobile responsive design
- Dark mode support

### Key UI Flows

**Sweep Flow:**
```
[Connect Wallet] → [View Dust] → [Select Tokens] → [Choose Destination] → [Review Quote] → [Sign & Execute] → [Track Progress] → [Success]
```

**Consolidation Flow:**
```
[Select Source Chains] → [Select Destination] → [View Routes] → [Review Fees] → [Execute] → [Track All Bridges] → [Success]
```

---

## 📋 Coordination Notes

### Shared Dependencies
All agents should:
- Follow existing code patterns in the repo
- Use TypeScript strict mode
- Add JSDoc comments to all public functions
- Update `docs/` if adding new features
- Add to existing test suites

### Environment Variables Needed
```bash
# All agents may need these in .env
DATABASE_URL=
REDIS_URL=
ALCHEMY_API_KEY=
PIMLICO_API_KEY=
ONEINCH_API_KEY=
LIFI_API_KEY=
COINGECKO_API_KEY=
HELIUS_API_KEY=        # Solana
```

### Order of Execution
Agents can work in parallel, but some dependencies exist:
- Agent 5 (Frontend) depends on APIs from Agents 1, 2, 3
- Agent 2 (Subscriptions) depends on sweep executor
- Agent 4 (Solana) is fully independent

### Integration Points
After all agents complete, integration work needed:
1. Wire consolidation API to frontend
2. Wire subscriptions API to frontend
3. Wire x402 payments to frontend (credit balance display)
4. End-to-end testing of all flows

---

*Generated: January 2026*
