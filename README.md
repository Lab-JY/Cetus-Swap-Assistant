# Cetus Swap Assistant 🌊

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue?style=flat-square)](https://sui.io)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green?style=flat-square)](https://docs.sui.io/concepts/cryptography/zklogin)
[![Move 2024](https://img.shields.io/badge/Smart_Contracts-Move_2024-purple?style=flat-square)](https://docs.sui.io/concepts/sui-move/move-2024)
[![Cetus](https://img.shields.io/badge/Powered_by-Cetus-orange?style=flat-square)](https://cetus.zone)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

A DEX interface built on Sui, participating in the **Sui Vibe Hackathon 2026**. This project utilizes **Programmable Transaction Blocks (PTBs)** and **zkLogin** to integrate Web2 authentication with Web3 liquidity.

---

## 🏆 Sui Vibe Hackathon 2026

This project is submitted for the **Sui Vibe Hackathon** (Jan 26 - Feb 12, 2026), targeting the **Cetus Track** and **Sui Tech Stack Track**.

### ✅ Participation Requirements Checklist

1.  **Project Start Time**: Codebase initialized on **Jan 27, 2026** (Verified via Commit History).
2.  **Move Language**: Smart contracts (`contracts/cetus_swap`) are written in **Move 2024 Edition**.
3.  **Official SDK**: Integrated with `@mysten/sui` (TypeScript SDK) and `@mysten/dapp-kit`.
4.  **Runnable Product**: Live Web App provided (see demo link above).
5.  **Open Source**: Source code available in this repository.
6.  **AI Disclosure**: See [AI_USAGE_DISCLOSURE.md](./AI_USAGE_DISCLOSURE.md) for details on AI tools used.

### 🎯 Track Alignment: Cetus Track
> "Must empower Cetus or integrate the aggregator or SDK"

This project implements a **Cetus Trading Terminal** with deep integration of the Cetus ecosystem:

*   **Aggregator Integration**: Utilizes `@cetusprotocol/aggregator-sdk` to perform smart routing across liquidity sources on both Mainnet and Testnet.
*   **Direct Pool Execution**: Implements `@cetusprotocol/cetus-sui-clmm-sdk` as a fallback mechanism for direct CLMM pool interaction.
*   **Liquidity Utilization**: Facilitates token swaps and "Zap" (Convert & Send) operations entirely powered by Cetus liquidity pools.
*   **On-Chain Data**: Generates verifiable on-chain volume and usage data for the Cetus protocol through custom event emission.

---

## 🌟 Key Features

### 1. Hybrid Routing Engine
*   **Execution**: Uses **Cetus Aggregator SDK** to find trading paths.
*   **Fallback**: Switches to **Cetus CLMM SDK** interaction if the Aggregator is unavailable.
*   **Reliability**: Designed to function across different network environments.

### 2. Atomic On-Chain Analytics (PTB Powered)
*   **Structure**: Swap transactions are constructed as **Programmable Transaction Blocks (PTBs)**.
*   **Recording**: A Move call to `cetus_swap::swap_helper::record_swap_event` is appended to the transaction block.
*   **Data**: Analytics are derived from on-chain events.

### 3. ⚡ Zap Mode: Atomic PTB Composability
"Zap Mode" demonstrates the power of **Sui Programmable Transaction Blocks (PTB)** by bundling complex operations into a single atomic transaction. Unlike traditional "Approve → Swap" flows, our architecture achieves:
*   **Dynamic Input Management**: Automatically merges dust coins (`MergeCoins`) or splits exact amounts (`SplitCoins`) within the same block to prepare funds.
*   **Embedded Protocol Logic**: Cetus Swap logic is executed as an embedded command sequence.
*   **Atomic Verification**: A custom Move call (`record_swap_event`) is chained to the swap. The event is *only* emitted if the swap succeeds, ensuring 100% accurate on-chain analytics.

### 4. Web2 Onboarding (zkLogin)
*   **Authentication**: Users sign in with a **Google Account**.
*   **Mechanism**: Uses **zkLogin** and the official Sui Proving Service to map Web2 identities to Web3 addresses.
*   **Security**: Uses ephemeral, session-based signing keys.

### 5. History Tracking
*   **Data Source**: The Swap History pulls data from Sui blockchain events.
*   **Time Handling**: Supports different timestamp formats (Epoch vs. Milliseconds).

---

## ✨ Features Overview

| Category | Capabilities |
| :--- | :--- |
| **Authentication** | ✅ **zkLogin (Google)** - No wallet needed<br>✅ **Wallet Adapter** - Standard wallet support<br>✅ **Session Management** - Secure ephemeral keys |
| **Trading** | ✅ **Hybrid Routing** - Aggregator (Mainnet/Testnet) + CLMM Fallback<br>✅ **Real-Time Quotes** - Live price updates<br>✅ **Slippage Protection** - Auto-calculation & safety checks |
| **Data & Analytics** | ✅ **On-Chain History** - Permanent, verifiable swap records<br>✅ **User Statistics** - Track total volume and swap counts (on-chain)<br>✅ **Explorer Integration** - Direct links to Suiscan |
| **UX / UI** | ✅ **Auto Network Switch** - Mainnet/Testnet detection<br>✅ **Responsive Design** - Mobile-first interface<br>✅ **Instant Feedback** - Toast notifications & Confetti effects |

---

## 🛣️ Roadmap

### Phase 1: Foundation (Current Status) ✅
*   [x] **Core Swap Engine**: Hybrid routing (Aggregator + CLMM) with intelligent fallback.
*   [x] **Web2 Onboarding**: Google zkLogin integration for frictionless entry.
*   [x] **On-Chain Analytics**: Atomic `SwapEvent` recording via PTB composability.
*   [x] **UX Polish**: Real-time quotes, slippage protection, and history tracking.

### Phase 2: Enhanced Utility (Current Status) ✅
*   [x] **Swap & Transfer**: Leverage the contract's `recipient` capability to allow swapping tokens and sending them directly to a third-party address (e.g., "Pay with SUI, Receive USDC").
*   [x] **Gas Estimation**: Real-time Gas fee preview for Transfer operations.
*   [ ] **Limit Orders**: Integrate Cetus Limit Order SDK for advanced trading strategies.
*   [ ] **Multi-Wallet Support**: Add support for more wallet adapters (Sui Wallet, Nightly, etc.).

### Phase 3: Ecosystem Expansion (Future Vision) 🔮
*   [ ] **"Swap-as-a-Service" SDK**: Package the frontend logic into an embeddable React component for GameFi and SocialFi projects.
*   [ ] **Credit Scoring System**: Build a user credit profile based on the on-chain swap history stored in `SwapRegistry`.
*   [ ] **Social Trading**: Introduce a leaderboard and "Copy Trading" feature based on top performers in the registry.

---

## �� Tech Stack

*   **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
*   **Sui Integration**:
    *   `@mysten/sui` & `@mysten/dapp-kit`
    *   `@mysten/zklogin`
*   **DeFi Protocols**:
    *   `@cetusprotocol/aggregator-sdk` (Smart Routing)
    *   `@cetusprotocol/cetus-sui-clmm-sdk` (Direct Swap)
*   **Smart Contracts**:
    *   Sui Move 2024 Edition
    *   Deployed on Testnet: `0x855950a86c5b082c0d3d3a9bf99d2d24c52c088c1af9655508439ce083c1b3d3`

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   pnpm or npm

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/sui-vibe-cetus-swap.git
    cd sui-vibe-cetus-swap
    ```

2.  **Install Frontend Dependencies**
    ```bash
    cd frontend
    npm install
    ```

3.  **Configure Environment**
    Create a `.env.local` file in the `frontend` directory:
    ```env
    # Sui Network (testnet | mainnet)
    NEXT_PUBLIC_SUI_NETWORK=testnet
    
    # Cetus Swap Contract Package ID (Must match the network)
    NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID=0x855950a86c5b082c0d3d3a9bf99d2d24c52c088c1af9655508439ce083c1b3d3
    
    # Google Client ID for zkLogin (Get from Google Cloud Console)
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
    
    # App URL (for redirects)
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Smart Contract Interface

The project includes a custom Move package `cetus_swap` that acts as an analytics layer.

```move
module cetus_swap::swap_helper {
    /// Emitted for every swap, carrying user stats and token details
    public struct SwapEvent has copy, drop {
        user: address,
        from_coin: ascii::String,
        to_coin: ascii::String,
        amount_in: u64,
        amount_out: u64,
        timestamp: u64,
    }

    /// Appended to PTBs to record swap actions atomically
    public entry fun record_swap_event(...) { ... }
}
```

---

## 🏆 Hackathon Track

**Primary Submission: Cetus Track**

> "Must empower Cetus or integrate the aggregator or SDK"

We have built a dedicated **Cetus Analytics & Trading Terminal** that fits this track perfectly:

1.  **Deepest Integration**: We don't just use one SDK; we implement a **Hybrid Engine** combining `@cetusprotocol/aggregator-sdk` (Smart Routing) AND `@cetusprotocol/cetus-sui-clmm-sdk` (Direct Fallback).
2.  **Empowering the Ecosystem**: We solve a critical data gap. By implementing **Atomic On-Chain Analytics** via PTB, we provide verifiable trading history and user volume stats for Cetus users—data that is currently hard to track on-chain.
3.  **Sui Tech Showcase**: While focused on Cetus, we leverage the best of Sui (zkLogin, Move 2024, PTB) to deliver the ultimate trading experience.

---

## 📄 License

MIT License.
