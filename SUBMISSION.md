# 🌊 SuiPay: The Ultimate Stablecoin Payment & Payroll Gateway

**Slogan**: Instant, High-Yield, and Zero-Barrier Global Finance on Sui.

---

## 📺 Project Overview
**SuiPay** is a decentralized payment infrastructure designed for the next generation of global businesses. It leverages the high-performance architecture of Sui to solve the high-cost and low-efficiency problems of traditional cross-border payments and payroll.

### 🎯 Track Selection
1.  **StableLayer Track (Primary)**: Fully integrated with StableLayer's stablecoin liquidity and yield-bearing vaults.
2.  **Sui Infrastructure Track**: Deeply utilizes Sui's native features like PTB and zkLogin.

---

## 🚀 Key Features & Innovations

### 1. ⚡ PTB-Powered Bulk Payroll (The "Sui" Way)
Unlike traditional chains that require looping or multiple transactions, SuiPay uses **Programmable Transaction Blocks (PTB)** to execute bulk salary payments.
-   **Efficiency**: 100+ recipients in a single atomic transaction.
-   **Vibe**: Drastically lower gas fees and near-instant finality.

### 2. 🔐 zkLogin: Seamless Web2 Onboarding
To remove the barrier for non-crypto users (employees and small merchants), SuiPay integrates **zkLogin**.
-   **UX**: Users can log in and receive payments using their **Google/GitHub** accounts.
-   **Impact**: No wallet extension required, bringing Web3 to the masses.

### 3. 🌊 StableLayer Yield Integration ("Pay-to-Earn")
We don't just move money; we make it grow. 
-   **Auto-Yield**: Merchants can toggle an "Auto-Yield" switch. When active, incoming USDC is automatically routed to **StableLayer's Yield Vaults**, earning interest while waiting for settlement.

### 4. 🦀 Robust Rust-based Indexer
Our backend is built with **Rust (Axum)** and features a real-time event indexer.
-   **Real-time**: Automatically synchronizes on-chain `PaymentReceived` events with the PostgreSQL database.
-   **Reliability**: Ensures merchants always see the up-to-date status of their global orders.

---

## 🛠 Technical Stack
-   **Smart Contracts**: Sui Move 2024 (Generic coins, Object-centric model).
-   **Backend**: Rust (Axum, SQLx, PostgreSQL).
-   **Frontend**: Next.js 14, Tailwind CSS, Shadcn UI, Mysten dApp Kit.
-   **Integrations**: StableLayer SDK (Liquidity/Yield), zkLogin (Auth).

---

## 🧠 Technical Challenges Overcome
-   **Move 2024 Generic Coins**: Implementing a generic `pay_order<T>` function that handles any coin type while ensuring safe `split` and `join` operations with automatic change return.
-   **Event Synchronization**: Building a concurrent indexer in Rust that polls the Sui RPC efficiently without hitting rate limits, ensuring data consistency between the chain and the DB.
-   **PTB Orchestration**: Designing the frontend logic to construct complex PTBs that handle multiple recipients and coin objects dynamically.

---

## 🛠 How to Verify (Run Locally)

### 1. Prerequisites
- Sui CLI (Testnet)
- Rust & Cargo
- PostgreSQL
- Node.js & npm

### 2. Smart Contract
```bash
cd contracts/suipay
sui client publish --gas-budget 100000000
# Save the Package ID to backend/.env (SUIPAY_PACKAGE_ID)
```

### 3. Backend (Rust)
```bash
cd backend
# Update DATABASE_URL and SUIPAY_PACKAGE_ID in .env
cargo run
```

### 4. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# Access at http://localhost:3000
```

---

## 📝 AI Usage Disclosure
- **AI Tool**: Google Gemini (via CLI Agent).
- **Usage**: Architecture design, Rust/Move code generation, and project documentation.
- **Key Prompts**: 
  - "Design a PTB-based payroll system on Sui."
  - "Implement a generic payment contract in Move 2024 with auto-yield logic."
  - "Build a Rust Axum backend with a Sui event indexer."

---

## 🌟 Feel the Vibe · Ship Real · Build on Sui
Built with ❤️ during the **Sui Vibe Hackathon 2026**.
