# 🌊 Cetus Swap Assistant (Sui Vibe Hackathon 2026)

[![Sui Hackathon](https://img.shields.io/badge/Sui-Vibe_Hackathon_2026-blue)](https://sui.io)
[![Cetus](https://img.shields.io/badge/Powered_by-Cetus_Aggregator-orange)](https://cetus.zone)
[![zkLogin](https://img.shields.io/badge/Auth-zkLogin-green)](https://docs.sui.io/concepts/cryptography/zklogin)
[![Move 2024](https://img.shields.io/badge/Smart_Contracts-Move_2024-purple)](https://docs.sui.io/concepts/sui-move/move-2024)
[![Network](https://img.shields.io/badge/Network-Mainnet_%26_Testnet-blue)]()

**Cetus Swap Assistant** is a next-generation DEX interface built on Sui, designed to bridge the gap between Web2 usability and Web3 liquidity. It features a unique **Hybrid Routing Engine** that intelligently switches between the **Cetus Aggregator SDK** (for best price execution on Mainnet) and direct **CLMM Pool interaction** (for robust testing environments), ensuring a 100% success rate across networks.

> **"Swap Tokens. Best Price. Zero Friction."**

---

## 🏆 Hackathon Achievements (P0 Milestones)

### P0-1: Official Sui Proving Service Integration ✅
Integrated the **official Sui Proving Service** (`https://prover.mystenlabs.com/v1`) for zkLogin authentication:
- **`getZkProofFromProvingService(jwt)`**: Calls the official Sui Proving Service to generate ZK proofs
- **`signTransactionWithZkLogin(tx, jwt)`**: Complete transaction signing flow with ephemeral keys
- **Key Achievement**: Users can now authenticate with Google and sign transactions without managing private keys
- **Implementation**: `frontend/src/utils/zklogin.ts` (lines 72-166)

### P0-2: Enhanced Move 2024 Smart Contract ✅
Upgraded `swap_helper.move` to use latest Move 2024 syntax and advanced features:
- **AdminCap**: Capability-based access control for registry management
- **SwapRegistry**: Global on-chain swap tracking with Tables for efficient storage
- **SwapRecord & UserStats**: Comprehensive swap history and user statistics
- **Events**: SwapEvent, UserStatsUpdated, RegistryInitialized for on-chain indexing
- **Key Achievement**: Full Move 2024 compliance with generics, Tables, and capability patterns
- **Implementation**: `contracts/cetus_swap/sources/swap_helper.move` (205 lines)

---

## 🌟 Core Features

### 1. 🧠 Intelligent Hybrid Routing (The "Unstoppable" Engine)
- **Problem**: Aggregator APIs are powerful but can be unstable on Testnets or during high-load events.
- **Solution**: We built a **Hybrid Fallback System**.
  - **Primary Mode**: Uses **Cetus Aggregator SDK** (v1.4.3) to find multi-hop routes (e.g., `USDC -> SUI -> CETUS`) for the absolute best price.
  - **Fallback Mode**: Automatically degrades to direct **CLMM SDK** (v5) interaction if the aggregator is unreachable or the network is Testnet.
  - **Transaction Management**: Intelligently manages transaction object lifecycle based on routing mode
- **Impact**: Zero downtime demos. If one path fails, the other takes over instantly.
- **Implementation**: `frontend/src/utils/cetus.ts` (getSwapQuote, buildSimpleSwapTx)

### 2. 🔐 Frictionless Onboarding (zkLogin + Official Proving Service)
- **Problem**: "Write down these 12 words" kills user conversion.
- **Solution**: Integrated **Google Login** via zkLogin with official Sui Proving Service.
- **Experience**: Users sign in with Google → Get a "Demo Wallet" instantly → Start swapping. No extensions required.
- **Security**: Ephemeral keys stored in sessionStorage, ZK proofs generated server-side
- **Implementation**: `frontend/src/utils/zklogin.ts` (setupEphemeralKey, getGoogleLoginUrl, signTransactionWithZkLogin)

### 3. 🛡️ Safety-First UX
- **Smart Filtering**: Automatically hides unsupported tokens on Testnet to prevent user errors.
- **Price Impact Protection**: Disables swap button when price impact exceeds 5% threshold
- **Transparent Feedback**: Real-time gas estimation, slippage protection, and success feedback.
- **Defensive Coding**: Handles "Package Not Found" and RPC errors gracefully.
- **Implementation**: `frontend/src/app/page.tsx` (handleSwap, quote validation)

### 4. 📊 On-Chain Swap Analytics
- **Swap Registry**: Tracks all swaps on-chain with user statistics
- **User Stats**: Maintains total_swaps, total_volume_in, total_volume_out, last_swap_time
- **Events**: Emits SwapEvent for every swap for easy indexing and analytics
- **Implementation**: `contracts/cetus_swap/sources/swap_helper.move` (execute_swap, get_user_stats)

---

## 🛠 Tech Stack

| Component | Technology | Version |
| :--- | :--- | :--- |
| **Routing Engine** | Cetus Aggregator SDK + Cetus CLMM SDK | v1.4.3 + v5 |
| **Frontend Framework** | Next.js | 16.1.5 |
| **Styling** | Tailwind CSS | Latest |
| **Blockchain Interaction** | @mysten/sui, @mysten/dapp-kit | Latest |
| **Authentication** | zkLogin + Official Sui Proving Service | Latest |
| **Smart Contracts** | Move 2024 | Edition 2024 |
| **State Management** | React Hooks + Local Storage | Native |

---

## 📂 Project Structure

```text
Cetus-Swap-Assistant/
├── frontend/                          # Next.js dApp
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main Swap UI & zkLogin integration
│   │   │   └── auth/
│   │   │       └── callback/page.tsx # Google OAuth callback handler
│   │   ├── utils/
│   │   │   ├── cetus.ts              # 🌟 Hybrid Routing Engine
│   │   │   ├── zklogin.ts            # 🔐 zkLogin + Proving Service
│   │   │   └── config.ts             # Network configuration
│   │   └── components/               # Reusable UI components
│   ├── public/                        # Static assets
│   ├── package.json
│   └── tsconfig.json
├── contracts/
│   └── cetus_swap/
│       ├── sources/
│       │   └── swap_helper.move       # 📊 Move 2024 Smart Contract
│       └── Move.toml                  # Move package config (edition = "2024")
├── README.md                          # This file
├── AI_DISCLOSURE.md                   # AI tools usage disclosure
└── .env.local.example                 # Environment variables template
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Sui CLI (for contract deployment)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create a `.env.local` file in the `frontend` directory:
```bash
# Network selection
NEXT_PUBLIC_SUI_NETWORK=testnet  # or mainnet

# Google OAuth (get from https://console.cloud.google.com)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# App URL (for zkLogin redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 3. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Deploy Smart Contract (Optional)
```bash
cd contracts/cetus_swap
sui move build
sui move publish --gas-budget 100000000
```

---

## 🔧 Configuration

### Supported Token Pairs

**Mainnet:**
- SUI ↔ USDC
- SUI ↔ CETUS
- USDC ↔ CETUS

**Testnet:**
- SUI ↔ MEME
- SUI ↔ IDOL_APPLE
- SUI ↔ IDOL_DGRAN

Add more pairs in `frontend/src/utils/config.ts` under `POOL_IDS`.

### Network Configuration
- **Mainnet**: Uses Cetus Aggregator SDK for multi-hop routing
- **Testnet**: Falls back to direct CLMM pool interaction

---

## 📋 API Reference

### Frontend Utils

#### `getSwapQuote(fromCoinType, toCoinType, amountIn, userAddress, byAmountIn)`
Fetches swap quote from Aggregator or CLMM fallback.

**Returns:**
```typescript
{
  amountOut: BN,
  estimatedFee: number,
  source: 'aggregator' | 'clmm' | 'error',
  routes?: Array<Route>,
  error?: boolean,
  errorMessage?: string
}
```

#### `buildSimpleSwapTx(tx, quote, inputCoin, userAddress, toCoinType, slippage)`
Builds transaction for swap execution.

**Returns:** `Transaction` object ready for signing

#### `signTransactionWithZkLogin(tx, jwt)`
Signs transaction using zkLogin with official Sui Proving Service.

**Returns:**
```typescript
{
  transactionBlockSerialized: string,
  signature: string
}
```

### Smart Contract Functions

#### `init_registry(ctx)`
Initializes the swap registry (call once).

#### `execute_swap<T>(coin, recipient, amount_out, registry, to_coin_type, ctx)`
Records a swap on-chain and updates user statistics.

#### `get_user_stats(registry, user)`
Returns `(total_swaps, total_volume_in, total_volume_out, last_swap_time)`

---

## 🧪 Testing

### Local Testing
```bash
# Test with Testnet
NEXT_PUBLIC_SUI_NETWORK=testnet npm run dev

# Test with Mainnet (requires funded wallet)
NEXT_PUBLIC_SUI_NETWORK=mainnet npm run dev
```

### Contract Testing
```bash
cd contracts/cetus_swap
sui move test
```

---

## 🐛 Troubleshooting

### "CetusRouter only supported on mainnet"
This is expected on Testnet. The app automatically falls back to direct CLMM pool interaction.

### "Package Not Found" Error
Ensure the contract is deployed to the network you're testing on.

### zkLogin Session Expired
Clear browser sessionStorage and re-authenticate with Google.

---

## 📚 Documentation

- [Sui Documentation](https://docs.sui.io)
- [Cetus Protocol](https://cetus.zone)
- [zkLogin Guide](https://docs.sui.io/concepts/cryptography/zklogin)
- [Move 2024 Guide](https://docs.sui.io/concepts/sui-move/move-2024)
- [Sui Proving Service](https://prover.mystenlabs.com)

---

## 📄 License

MIT License. Built with ❤️ for the Sui Community.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

For issues or questions, please open an issue on GitHub or contact the development team.
