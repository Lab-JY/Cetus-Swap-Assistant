# Demo Runbook

## Goal
Complete a stable 3-5 minute demo covering:
1. Swap
2. Zap (swap + send)
3. Receipt
4. Insights

## Pre-Demo Setup
- Configure `.env.local`
- Start app: `cd frontend && npm run dev`
- Prepare test account with SUI gas
- Keep one valid recipient address for transfer flow

## Recommended Demo Flow

### A. Swap (Main Feature)
1. Open app home page
2. Connect wallet or login with Google
3. Select token pair and input amount
4. Show quote/route details and preflight status
5. Execute swap and display tx digest

### B. Zap Transfer
1. Switch to transfer mode
2. Set recipient address
3. Select different output token to enter Zap mode
4. Execute and show final success status

### C. Receipt Page
1. Open generated receipt link
2. Show on-chain fields (from/to/amount/route/user)
3. Open explorer link from receipt page

### D. Insights
1. Switch to insights tab
2. Show price chart
3. Show AI insight card and leaderboard

## Fallback Talking Points (if network unstable)
- Quote service supports cache and in-flight dedupe
- RPC layer has health check and fallback
- Preflight detects failures before signing
- CLMM fallback path is available when aggregator route fails

## Judge Q&A Quick Notes
- Why Sui? -> PTB + object model + high-throughput UX
- Why Cetus? -> Aggregator depth + CLMM fallback reliability
- What is on-chain? -> events + receipt objects + tx proofs
- AI usage? -> fully disclosed in `AI_USAGE_DISCLOSURE.md`
