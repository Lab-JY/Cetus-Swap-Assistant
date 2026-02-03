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

### 1. Hybrid Routing Engine (Cetus Powered)
*   **Smart Aggregation**: Leverages **Cetus Aggregator SDK** to find the most efficient trading paths across liquidity sources.
*   **Resilient Fallback**: Seamlessly switches to **Cetus CLMM SDK** for direct pool interaction if the aggregator API is unreachable.
*   **Dual-Mode Compatibility**: Optimized for both **Mainnet** (Aggregator-first) and **Testnet** (Direct Pool focus), ensuring a consistent dev experience.

### 2. Atomic Zap (Swap & Transfer)
Demonstrating the true power of **Sui Programmable Transaction Blocks (PTB)**:
*   **One-Click Zap**: Bundles a Token Swap and a Transfer into a **single atomic transaction**.
*   **Efficiency**: Eliminates the need for multiple approvals. Users sign once, and the protocol handles the swap logic and immediately routes the output tokens to the recipient.
*   **Cross-Token Payments**: Enables "Pay in SUI, Recipient gets USDC" scenarios effortlessly.

### 3. Web2-Native Onboarding (zkLogin)
*   **Zero Friction**: Users can trade using just their **Google Account**. No browser extensions or seed phrases required.
*   **Non-Custodial**: Powered by **Sui zkLogin**, maintaining full self-custody security while offering a Web2-like UX.
*   **Session Management**: Implements secure session storage for ephemeral keys, allowing users to trade continuously without re-signing every action.

### 4. Verifiable On-Chain Analytics
*   **Atomic Event Recording**: A custom Move contract (`cetus_swap::swap_helper`) is integrated into the PTB flow.
*   **Accuracy**: The `SwapEvent` is *only* emitted if the swap transaction succeeds, guaranteeing 100% accurate data for history tracking.
*   **Unified History**: The frontend intelligently aggregates fragmented on-chain events (like CLMM's split swap/transfer actions) into cohesive "Zap" records.

---

## 🤖 AI-Augmented Development

This project was built with the assistance of **Trae**, an AI-powered IDE. The collaboration highlighted how AI can accelerate Web3 development:

*   **Smart Contract Generation**: AI assisted in scaffolding the Move 2024 smart contracts, ensuring adherence to the latest syntax and security patterns.
*   **Frontend Logic**: Complex React hooks for state management and the "Hybrid Routing" logic were co-authored with AI to handle edge cases efficiently.
*   **Debugging & Optimization**: AI played a crucial role in debugging the **CLMM Zap** logic, identifying the need for "Fuzzy Time Matching" to group split blockchain events into unified UI records.
*   **Documentation**: Automated generation of technical documentation and inline code comments to improve maintainability.

> See [AI_USAGE_DISCLOSURE.md](./AI_USAGE_DISCLOSURE.md) for a detailed breakdown of prompts and workflows.

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
