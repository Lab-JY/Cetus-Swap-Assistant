# Cetus Swap Assistant

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue?style=flat-square)](https://sui.io)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green?style=flat-square)](https://docs.sui.io/concepts/cryptography/zklogin)
[![Move 2024](https://img.shields.io/badge/Smart_Contracts-Move_2024-purple?style=flat-square)](https://docs.sui.io/concepts/sui-move/move-2024)
[![Cetus](https://img.shields.io/badge/Powered_by-Cetus-orange?style=flat-square)](https://cetus.zone)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Mainnet_%26_Testnet-blue?style=flat-square)]()

A next-generation DEX interface built on Sui, designed to bridge the gap between Web2 usability and Web3 liquidity.

> **"Swap Tokens. Best Price. Zero Friction."**

---

## Highlights

### 🧠 Intelligent Hybrid Routing Engine
- **Primary Mode**: Uses Cetus Aggregator SDK to find multi-hop routes for the best price on Mainnet
- **Fallback Mode**: Automatically switches to direct CLMM SDK interaction on Testnet or when Aggregator is unavailable
- **Zero Downtime**: If one routing path fails, the other takes over instantly
- **Result**: 100% success rate across networks

### 🔐 Frictionless Web2 Onboarding
- **Google Login Integration**: Users sign in with Google via zkLogin
- **Official Sui Proving Service**: Secure ZK proof generation for transaction signing
- **No Private Keys**: Users get a "Demo Wallet" instantly without managing seed phrases
- **Ephemeral Keys**: Secure session-based key management

### 📊 On-Chain Swap Analytics
- **Swap Registry**: Tracks all swaps on-chain with user statistics
- **User Stats**: Maintains total_swaps, total_volume_in, total_volume_out, last_swap_time
- **Events**: Emits SwapEvent for every swap for easy indexing and analytics
- **Move 2024**: Full compliance with latest Move language features

### 🛡️ Safety-First UX
- **Smart Filtering**: Automatically hides unsupported tokens to prevent user errors
- **Price Impact Protection**: Disables swap when price impact exceeds 5%
- **Real-time Feedback**: Gas estimation, slippage protection, and success notifications
- **Graceful Error Handling**: Handles network errors and edge cases elegantly

### 💳 Multi-Authentication Support
- **Google Login**: Frictionless Web2 onboarding via zkLogin
- **Wallet Connection**: Traditional wallet adapter support
- **Unified Experience**: Same address across both authentication methods

### 🎨 Modern UI/UX
- **Collapsible Swap History**: Card-style drawer with transaction links
- **Real-time Quotes**: Live price updates as you type
- **Multiple Routes**: View and select different swap routes
- **Responsive Design**: Works seamlessly on desktop and mobile

---

## Supported Networks

**Mainnet:**
- SUI ↔ USDC
- SUI ↔ CETUS
- USDC ↔ CETUS

**Testnet:**
- SUI ↔ MEME
- SUI ↔ IDOL_APPLE
- SUI ↔ IDOL_DGRAN

---

## Tech Stack

- **Frontend**: Next.js 16.1.5, React, Tailwind CSS
- **Blockchain**: Sui SDK, Cetus Aggregator SDK, Cetus CLMM SDK
- **Authentication**: zkLogin, Official Sui Proving Service
- **Smart Contracts**: Move 2024
- **State Management**: React Hooks, Local Storage

---

## Key Features

✅ Hybrid routing with automatic fallback
✅ Google login via zkLogin
✅ Multi-hop swap routes
✅ On-chain swap analytics
✅ Swap history tracking
✅ Price impact protection
✅ Real-time quote updates
✅ Transaction explorer links
✅ Responsive design
✅ Move 2024 smart contracts

---
