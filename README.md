# 🌊 Cetus Swap Assistant (Sui Hackathon 2026)

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue)](https://sui.io)
[![Cetus](https://img.shields.io/badge/Powered_by-Cetus_Aggregator-orange)](https://cetus.zone)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green)](https://docs.sui.io/concepts/cryptography/zklogin)
[![Network](https://img.shields.io/badge/Network-Mainnet_%26_Testnet-purple)]()

**Cetus Swap Assistant** is a next-generation DEX interface built on Sui, designed to bridge the gap between Web2 usability and Web3 liquidity. It features a unique **Hybrid Routing Engine** that intelligently switches between the **Cetus Aggregator SDK** (for best price execution on Mainnet) and direct **CLMM Pool interaction** (for robust testing environments), ensuring a 100% success rate across networks.

> **"Swap Tokens. Best Price. Zero Friction."**

---

## 🌟 Key Features (Hackathon Highlights)

### 1. 🧠 Intelligent Hybrid Routing (The "Unstoppable" Engine)
- **Problem**: Aggregator APIs are powerful but can be unstable on Testnets or during high-load events.
- **Solution**: We built a **Hybrid Fallback System**.
  - **Primary Mode**: Uses **Cetus Aggregator SDK** (v1.4.3) to find multi-hop routes (e.g., `USDC -> SUI -> CETUS`) for the absolute best price.
  - **Fallback Mode**: Automatically degrades to direct **CLMM SDK** (v5) interaction if the aggregator is unreachable or the network is Testnet.
- **Impact**: Zero downtime demos. If one path fails, the other takes over instantly.

### 2. 🔐 Frictionless Onboarding (zkLogin)
- **Problem**: "Write down these 12 words" kills user conversion.
- **Solution**: Integrated **Google Login** via zkLogin.
- **Experience**: Users sign in with Google -> Get a "Demo Wallet" instantly -> Start swapping. No extensions required.

### 3. �️ Safety-First UX
- **Smart Filtering**: Automatically hides unsupported tokens on Testnet to prevent user errors.
- **Transparent Feedback**: Real-time gas estimation, slippage protection, and "Confetti" success feedback.
- **Defensive Coding**: Handles "Package Not Found" and RPC errors gracefully.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Routing Engine** | **Cetus Aggregator SDK** (Multi-hop) + **Cetus CLMM SDK** (Direct) |
| **Frontend** | **Next.js 14**, Tailwind CSS, Lucide React |
| **Blockchain Interaction** | **@mysten/dapp-kit**, **@mysten/sui** |
| **Authentication** | **zkLogin** (Google OAuth) |
| **State Management** | React Hooks + Local Storage (for session persistence) |

---

## 📂 Project Structure

```text
sui-hack/
├── frontend/           # Next.js dApp
│   ├── src/app/        # Pages (Swap, Auth Callback)
│   ├── src/utils/      # Core Logic
│   │   ├── cetus.ts    # 🌟 Hybrid Routing Engine Implementation
│   │   ├── zklogin.ts  # zkLogin Authentication Logic
│   │   └── config.ts   # Network-aware Configuration
│   └── public/         # Static Assets
└── README.md           # Documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create a `.env.local` file:
```bash
NEXT_PUBLIC_SUI_NETWORK=testnet # or mainnet
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

### 3. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## 📜 License
MIT License. Built with ❤️ for the Sui Community.
