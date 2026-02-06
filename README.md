# Cetus Swap Assistant (Cetus RoutePay)

> Build on Sui, build the vibe.

Cetus Swap Assistant is a Sui dApp focused on **swap + transfer (Zap) + on-chain receipt + insights**.
It integrates Cetus Aggregator and CLMM fallback, supports wallet and zkLogin flows, and provides a ready-to-demo UI for the Sui Vibe Hackathon.

## Why This Project

- **Cetus Track Ready**: uses `@cetusprotocol/aggregator-sdk` and `@cetusprotocol/cetus-sui-clmm-sdk`
- **Sui-native Workflow**: PTB composition, on-chain events, Move receipts, RPC fallback
- **Product Experience**: swap/transfer/insights in one page, transaction stepper, receipt page
- **Hackathon Friendly**: open source repo + clear run instructions + AI usage disclosure

## Core Features

### Trading
- Smart routing via Cetus Aggregator
- CLMM direct-pool fallback when aggregator route is unavailable
- Zap mode (swap + send)
- Quote caching and in-flight deduplication
- Preflight dry-run checks before execution

### User Experience
- Wallet connect and zkLogin (Google OAuth callback flow)
- Transaction progress stepper and friendly error mapping
- Receipt object links and receipt detail page
- Swap/transfer history drawer with grouped Zap visualization

### Data & Insights
- Market spot + price history proxy APIs (CoinGecko)
- Chain event proxy API (Sui RPC with fallback)
- Rule-based insight generation (non-LLM)
- Recent trade card and leaderboard

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **Sui**: `@mysten/sui`, `@mysten/dapp-kit`
- **Cetus**: Aggregator SDK + CLMM SDK
- **Charts/UI**: Recharts, Lucide
- **Contract**: Move 2024 (`edition = "2024.beta"`)

## Repository Structure

```text
.
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                   # swap / transfer / insights main page
│   │   │   ├── receipt/[id]/page.tsx      # receipt detail page
│   │   │   └── api/
│   │   │       ├── cetus/quote/route.ts   # aggregator quote proxy
│   │   │       ├── market/                 # CoinGecko proxy endpoints
│   │   │       └── sui/events/route.ts     # queryEvents proxy endpoint
│   │   ├── components/
│   │   └── utils/
│   └── .env.local.example
├── contracts/
│   └── cetus_swap/
│       ├── Move.toml
│       ├── Published.toml
│       └── sources/swap_helper.move
├── AI_USAGE_DISCLOSURE.md
└── README.md
```

## Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9

### Install & Run

```bash
git clone <your-repo-url>
cd Cetus-Swap-Assistant/frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### Quality Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Environment Variables

Copy from `frontend/.env.local.example`.

### Required

| Name | Description |
|---|---|
| `NEXT_PUBLIC_SUI_NETWORK` | `mainnet` or `testnet` |
| `NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID` | Move package id for `cetus_swap::swap_helper` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id for zkLogin |
| `NEXT_PUBLIC_APP_URL` | callback base url |

### Optional

| Name | Description |
|---|---|
| `NEXT_PUBLIC_ENABLE_RECEIPTS` | enable/disable on-chain receipt minting |
| `NEXT_PUBLIC_CETUS_PARTNER_ID` | partner id for Zap referral |
| `NEXT_PUBLIC_QUOTE_CACHE_TTL_MS` | quote cache TTL (default 5000 ms) |
| `NEXT_PUBLIC_SUI_RPC_URLS_MAINNET` | comma-separated RPC list |
| `NEXT_PUBLIC_SUI_RPC_URLS_TESTNET` | comma-separated RPC list |
| `COINGECKO_API_KEY` / `COINGECKO_DEMO_KEY` | optional market API credentials |

## API Endpoints

### Quote
- `GET /api/cetus/quote?from=<coin>&target=<coin>&amount=<u64>&byAmountIn=true`

### Market
- `GET /api/market/spot?symbol=SUI`
- `GET /api/market/price-history?symbol=SUI`

### Chain Events
- `GET /api/sui/events?eventType=<MoveEventType>&limit=50`

## Smart Contract Notes

Move module: `cetus_swap::swap_helper`

Includes:
- `SwapEvent`, `TransferEvent`, `SwapReceiptMinted`, `ZapReceiptMinted`
- `mint_swap_receipt`, `mint_zap_receipt`, `record_swap_event`, `transfer_coin_with_memo`

Deploy path:

```bash
cd contracts/cetus_swap
sui client publish --gas-budget 100000000
```

Published package ids are tracked in `contracts/cetus_swap/Published.toml`.

## Hackathon Submission Checklist (Sui Vibe)

- [x] Built on Sui + Move contract included
- [x] Move 2024 syntax (`contracts/cetus_swap/Move.toml`)
- [x] Uses official Sui SDK
- [x] Cetus SDK integration (track match)
- [x] Runnable web app + core demo flow
- [x] Public source code + README
- [x] AI usage disclosure: `AI_USAGE_DISCLOSURE.md`

## Known Limitations

- Contract `timestamp` currently stores `epoch` instead of unix milliseconds.
- In CLMM fallback Zap mode, transfer may require second signing flow depending on path.
- If you force Turbopack (`next build`) in restricted sandbox environments, build may fail; use default `npm run build` (webpack).


## Submission Links (Fill Before Deadline)

| Item | Value |
|---|---|
| Live dApp URL | TBD |
| Demo Video URL | TBD |
| Repository URL | TBD |
| Submission Commit Hash | TBD |
| Contract Package ID (mainnet) | TBD |
| Contract Package ID (testnet, optional) | TBD |

## Demo Media Placeholders

Add real images/GIFs before final submission. Recommended files:
- docs/assets/00-end-to-end.gif
- docs/assets/01-swap.png
- docs/assets/02-zap.png
- docs/assets/03-receipt.png
- docs/assets/04-insights.png

Embed examples:
- ![End-to-end Demo](docs/assets/00-end-to-end.gif)
- ![Swap Flow](docs/assets/01-swap.png)
- ![Zap Flow](docs/assets/02-zap.png)
- ![Receipt Page](docs/assets/03-receipt.png)
- ![Insights Page](docs/assets/04-insights.png)

## Additional Docs

- Submission checklist: `docs/SUBMISSION_CHECKLIST.md`
- Demo runbook: `docs/DEMO_RUNBOOK.md`

## AI Usage Disclosure

See: [AI_USAGE_DISCLOSURE.md](AI_USAGE_DISCLOSURE.md)

## License

MIT. See [LICENSE](LICENSE).
