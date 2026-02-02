# Cetus Swap Assistant 🌊

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue?style=flat-square)](https://sui.io)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green?style=flat-square)](https://docs.sui.io/concepts/cryptography/zklogin)
[![Move 2024](https://img.shields.io/badge/Smart_Contracts-Move_2024-purple?style=flat-square)](https://docs.sui.io/concepts/sui-move/move-2024)
[![Cetus](https://img.shields.io/badge/Powered_by-Cetus-orange?style=flat-square)](https://cetus.zone)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Swap Tokens. Best Price. Zero Friction.**

A next-generation DEX interface built on Sui, participating in the **Sui Vibe Hackathon 2026**. This project demonstrates the power of **Programmable Transaction Blocks (PTBs)** and **zkLogin** to bridge the gap between Web2 usability and Web3 liquidity.

---

## 🌟 Key Innovations

### 1. 🧠 Intelligent Hybrid Routing Engine
*   **Best Execution**: Automatically finds the best price using **Cetus Aggregator SDK** on both Mainnet and Testnet.
*   **Robust Fallback**: Seamlessly switches to direct **Cetus CLMM SDK** interaction if the Aggregator is unavailable or finds no routes (e.g., low liquidity on Testnet).
*   **Zero Downtime**: Ensures 100% success rate across network environments.

### 2. 🔗 Atomic On-Chain Analytics (PTB Powered)
*   **Composability**: We don't just "read" data; we "write" it. Every swap transaction—whether routed via Aggregator or Direct Pool—is constructed as a **Programmable Transaction Block (PTB)**.
*   **Atomic Recording**: A custom Move call to `cetus_swap::swap_helper::record_swap_event` is appended to the *same* transaction block as the swap.
*   **True Data**: Analytics are not off-chain logs; they are on-chain events guaranteed by the Sui consensus.

### 3. 🔐 Frictionless Web2 Onboarding (zkLogin)
*   **No Seed Phrases**: Users sign in with their **Google Account**.
*   **Non-Custodial**: Uses **zkLogin** and the official Sui Proving Service to map Web2 identities to Web3 addresses without private key management.
*   **Ephemeral Keys**: secure, session-based signing keys.

### 4. ⚡ Real-Time "Source of Truth" History
*   **Chain-First Data**: The Swap History drawer pulls data directly from the Sui blockchain events, ensuring cross-device consistency.
*   **Smart Time Resolution**: Automatically handles different timestamp formats (Epoch vs. Milliseconds) for accurate reporting.

---

## 🛠 Tech Stack

*   **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
*   **Sui Integration**:
    *   `@mysten/sui` & `@mysten/dapp-kit`
    *   `@mysten/zklogin`
*   **DeFi Protocols**:
    *   `@cetusprotocol/aggregator-sdk` (Smart Routing)
    *   `@cetusprotocol/cetus-sui-clmm-sdk` (Direct Swap)
*   **Smart Contracts**:
    *   Sui Move 2024 Edition
    *   Deployed on Testnet: `0x39ef07af8dd8da1ecf5a6156807250c0d36ddeeed77cdd6147cf2a3e8873b6f9`

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
    NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID=0x39ef07af8dd8da1ecf5a6156807250c0d36ddeeed77cdd6147cf2a3e8873b6f9
    
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

## 🏆 Hackathon Tracks

This project targets the **Cetus Track** and **Sui Tech Stack Track**:
*   **Cetus Integration**: Deep integration of Aggregator and CLMM SDKs.
*   **Sui Vibe**: Focus on UX (zkLogin) and Composability (PTB).

---

## 📄 License

MIT License. Built with ❤️ for the Sui Community.
