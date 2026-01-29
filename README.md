# 🌊 SuiStream

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue)](https://deepsurge.io)
[![StableLayer](https://img.shields.io/badge/Integrated-StableLayer-cyan)](https://stablelayer.site)
[![Cetus](https://img.shields.io/badge/Integrated-Cetus_Aggregator-orange)](https://cetus.zone)

**SuiStream** (formerly SuiPay) is the next-generation financial operating system for Web3 merchants. It transforms static payments into a dynamic stream of yield.

> **"Stream Money. Earn Yield. Zero Friction."**

---

## 🌟 The Vibe & The Solution

We are building on **Sui** because only Sui provides the speed and composability (PTB) to make money programmable.

### 1. 💰 The "Idle Capital" Problem (StableLayer Track)
Merchants receive stablecoins that sit idle in wallets, losing value to inflation.
-   **SuiStream Solution**: **Intent-based Auto-Yield**.
-   **How it works**: Merchants toggle "Auto-Yield" on their dashboard. Our smart contract signals this intent via events. Off-chain keepers automatically route funds into **StableLayer** protocol.
-   **Result**: Your payment terminal is now a high-yield savings account (~12% APY).

### 2. 💱 The "Token Mismatch" Problem (Cetus Track)
Employees want SUI, but merchants hold USDC.
-   **SuiStream Solution**: **Payroll Swap Aggregation**.
-   **How it works**: Integrated **Cetus Aggregator SDK**. When running payroll, merchants can pay with ANY token. We automatically find the best route and execute the swap + distribution in a **single atomic PTB**.
-   **Result**: Pay 100 employees in their preferred token with one click.

### 3. 🚧 The "Onboarding" Problem (Consumer Track)
Web2 merchants don't have wallets.
-   **SuiStream Solution**: **Zero-Knowledge Onboarding**.
-   **How it works**: Full **zkLogin** integration. Sign in with Google. No seed phrases.
-   **Result**: Web2 experience, Web3 power.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Smart Contracts** | **Move 2024** (Object-centric design) |
| **DeFi Integrations** | **StableLayer** (Yield), **Cetus** (Swap/Aggregator) |
| **Frontend** | Next.js 14, Tailwind, **Sui dApp Kit**, Recharts |
| **Backend** | Rust (Axum, SQLx), PostgreSQL |
| **Indexer** | Custom Rust Indexer (Event-driven architecture) |

---

## 📂 Project Structure

```text
sui_hackathon/
├── contracts/       # Sui Move contracts (v2024 edition)
├── backend/         # Rust Axum server & Indexer
├── frontend/        # Next.js Dashboard & Checkout Terminal
└── SUBMISSION.md    # Detailed hackathon submission docs
```

---

## 🏁 Quick Start for Judges

### 1. Database Setup
```bash
# Ensure PostgreSQL is running
psql -d suistream -f backend/schema.sql
```

### 2. Deploy Contract
```bash
cd contracts/suipay
sui client publish --gas-budget 100000000
# Update the Package ID in backend/.env
```

### 3. Run Backend (Rust)
```bash
cd backend
# Edit .env with your DATABASE_URL and SUIPAY_PACKAGE_ID
cargo run
# Server runs on localhost:3002
```

### 4. Run Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# App runs on localhost:3000
```

---

## 🏆 Hackathon Tracks Targeted

### 1. StableLayer Track 🌊
We implemented a complete **Merchant Yield System**. Instead of building another DEX, we built a **source of TVL** for StableLayer. We bring real merchant cash flow into the protocol.

### 2. Cetus Track 🐬
We integrated **Cetus Aggregator** directly into the Payroll flow. This demonstrates a high-value use case for aggregators: **B2B Bulk Payments**.

### 3. Sui Tech Stack (Vibe) ⚡
-   **Move 2024**: Used latest syntax.
-   **PTB**: Used for batch payroll (SplitCoins + TransferObjects).
-   **zkLogin**: Used for seamless onboarding.

---

Built with ❤️ for the **Sui Vibe Hackathon 2026**.
