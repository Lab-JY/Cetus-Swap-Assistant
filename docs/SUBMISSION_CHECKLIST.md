# Sui Vibe Hackathon Submission Checklist

## 1) Project Start Time
- [ ] Provide git history proof that project started on/after 2026-01-27
- [ ] Keep first commit date and major feature timeline ready for judges

## 2) Move 2024
- [x] `contracts/cetus_swap/Move.toml` uses `edition = "2024.beta"`
- [ ] Verify contract can compile with current Sui toolchain in your release environment

## 3) Official SDK Usage
- [x] Uses official Sui SDK (`@mysten/sui`, `@mysten/dapp-kit`)
- [x] Uses Cetus SDK (`@cetusprotocol/aggregator-sdk`, `@cetusprotocol/cetus-sui-clmm-sdk`)

## 4) Runnable Product & Live Website
- [ ] Deploy frontend URL and verify accessibility
- [ ] Prepare one stable demo wallet/account
- [ ] Ensure demo flow is reproducible (Swap, Zap, Receipt, Insights)

## 5) Open Source
- [x] Public repository with frontend + contract code
- [x] README includes run/deploy instructions
- [ ] Tag a stable submission commit/hash

## 6) AI Usage Disclosure
- [x] AI disclosure file exists: `AI_USAGE_DISCLOSURE.md`
- [ ] Re-check tool/model/prompt details before final submission

## Final Pre-Submission Command Checklist
```bash
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

## Demo Evidence Checklist
- [ ] Live URL
- [ ] Demo video (recommended)
- [ ] README screenshots/GIFs (recommended)
- [ ] Contract package id(s)
- [ ] Team info (if multi-member)
