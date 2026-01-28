# 🌊 SuiPay (Stablecoin Payment Gateway)

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue)](https://deepsurge.io)
[![StableLayer](https://img.shields.io/badge/Integrated-StableLayer-cyan)](https://stablelayer.site)

**SuiPay** is a high-performance decentralized payment infrastructure built on the Sui blockchain. It combines the atomic efficiency of **Programmable Transaction Blocks (PTB)** with the yield-bearing power of **StableLayer** to create a seamless bridge between global commerce and DeFi.

---

## 🚀 Why SuiPay?

In traditional finance, cross-border payments take days and cost 5-8% in fees. On-chain payments solve this but introduce high user barriers. **SuiPay** removes these barriers while adding a "Yield" layer that makes money work for the merchant.

### 🌟 Killer Features
-   **⚡ Atomic Bulk Payroll**: Pay 100+ employees in a single signature using Sui's PTB. Drastically reduced gas and near-instant finality.
-   **🔐 zkLogin Integration**: Onboard non-crypto merchants and employees with just a Google account.
-   **🌊 StableLayer Auto-Yield**: Turn your checkout terminal into a savings account. Idle USDC in the merchant account automatically earns APY via StableLayer protocol.
-   **🦀 Event-Driven Reliability**: A Rust-based indexer ensures the backend and frontend are always in sync with on-chain events.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Smart Contracts** | Move 2024 (Object-centric, Generic coins) |
| **Backend API** | Rust (Axum, SQLx, JWT) |
| **Database** | PostgreSQL |
| **Indexer** | Custom Rust Indexer (JSON-RPC Polling) |
| **Frontend** | Next.js 14, Tailwind CSS, Mysten dApp Kit |

---

## 📂 Project Structure

```text
sui_hackathon/
├── contracts/       # Sui Move contracts (v2024)
├── backend/         # Rust Axum server & Indexer
├── frontend/        # Next.js Dashboard & Checkout Terminal
└── SUBMISSION.md    # Detailed hackathon submission docs
```

---

## 🏁 Quick Start

### 1. Database Setup
```bash
# Ensure PostgreSQL is running
# Initialize the schema
psql -d your_db -f backend/schema.sql
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
```

### 4. Run Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

---

## 🏆 Hackathon Goals
- **StableLayer Track**: Showcase real-world utility for stablecoin liquidity and yield vaults.
- **Sui Infrastructure**: Utilize PTB and zkLogin to push the boundaries of UX.

---

Built with ❤️ by [Your Name] for the **Sui Vibe Hackathon 2026**.
"Feel the Vibe, Ship the Real."