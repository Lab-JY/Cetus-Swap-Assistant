# 🌊 Cetus Swap Assistant (Sui Hackathon 2026)

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue)](https://sui.io)
[![Cetus](https://img.shields.io/badge/Integrated-Cetus_Aggregator-orange)](https://cetus.zone)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green)](https://docs.sui.io/concepts/cryptography/zklogin)

A streamlined, "Best Price" Swap dApp built on **Sui**, powered by **Cetus Aggregator SDK**, and featuring **zkLogin** for frictionless onboarding.

> **"Swap Tokens. Best Price. Zero Friction."**

---

## 🌟 Key Features (Hackathon Tracks)

### 1. 🐬 Cetus Track: Aggregator Integration
- **Problem**: Users struggle to find the best exchange rates across multiple DEXs.
- **Solution**: We integrated the **Cetus Aggregator SDK** to automatically find and route trades through the most efficient liquidity pools.
- **Implementation**: Real-time quote fetching, multi-hop routing visualization, and one-click execution.

### 2. 🔐 Consumer Track: zkLogin Onboarding
- **Problem**: Creating a wallet and managing seed phrases is a barrier for Web2 users.
- **Solution**: Integrated **Google Login** via zkLogin.
- **Implementation**: Users can sign in with their Google account to instantly get a Sui address and start swapping.

### 3. 💧 Modern UX/UI
- Real-time balance updates.
- "MAX" button for easy inputs (gas optimized).
- Clear routing visualization.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Smart Contracts** | **Move 2024** (Helper module for on-chain events) |
| **DeFi Integration** | **Cetus Aggregator SDK** |
| **Authentication** | **zkLogin** (Google OAuth + Ephemeral Keys) |
| **Frontend** | **Next.js 14**, Tailwind CSS, **Sui dApp Kit** |

---

## 📂 Project Structure

```text
sui-hack/
├── contracts/       # Sui Move contracts (v2024 edition)
│   └── suipay/      # SwapHelper module
├── frontend/        # Next.js dApp
│   ├── src/app/     # Pages (Swap, Auth Callback)
│   └── src/utils/   # SDK wrappers (Cetus, zkLogin)
└── AI_DISCLOSURE.md # Mandatory AI Usage Disclosure
```

---

## 🚀 Quick Start (Deployment & Running)

### Prerequisites
- Node.js v18+
- Sui CLI (optional, for contract deployment)

### 1. Run Frontend (dApp)
The frontend is the core of this submission.

1. Configure Environment:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Contract ID and Google Client ID
   ```

2. Install & Run:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Open http://localhost:3000
   ```

### 2. (Optional) Deploy Contracts
The dApp works with pure SDK logic, but you can deploy the helper contract for on-chain event logging.

```bash
cd contracts/cetus_swap
sui move build
sui client publish --gas-budget 100000000
```

---

## 📜 License
MIT License. Open Source for the Sui Community.
