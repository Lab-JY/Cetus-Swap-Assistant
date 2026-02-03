# 🤖 AI Usage Disclosure (Single Source)

In compliance with the **Sui Vibe Hackathon 2026** rules (Requirement #6), we fully disclose the use of AI tools in this project. This document is the **only** AI usage disclosure file for the repository.

---

## 1. AI Tools Used

| Tool Name | Model / Version | Usage |
| :--- | :--- | :--- |
| **Trae IDE** | Gemini-3-Pro-Preview (200k) | **Primary Development Agent**. Used for end-to-end feature implementation, bug fixing, architecture planning, and documentation. |
| **Claude Code** | Claude Haiku 4.5 | Code generation, debugging, refactoring, problem-solving, and documentation writing |
| **Google Gemini** | Gemini 3 Pro | Code analysis, architectural design, and complex problem-solving |
| **GitHub Copilot** | GPT-5.2-Codex | Inline code completion and boilerplate generation |
| **OpenAI ChatGPT (Codex CLI)** | GPT-5 | Documentation cleanup, AI disclosure consolidation, and hackathon compliance edits |

---

## 2. Detailed Usage & Prompts

### P0-1: Official Sui Proving Service Integration

#### Prompt 1: Initial zkLogin Integration
**Prompt:**
```
Integrate the official Sui Proving Service (https://prover.mystenlabs.com/v1)
for zkLogin authentication. Create functions to:
1. Call the Proving Service to generate ZK proofs from JWT tokens
2. Sign transactions using zkLogin with ephemeral keys
3. Handle the complete flow from Google OAuth to transaction signing
```

**Result:** Created `getZkProofFromProvingService()` and `signTransactionWithZkLogin()` functions in `frontend/src/utils/zklogin.ts` (lines 72-166)

#### Prompt 2: Fixing TypeScript Type Errors
**Prompt:**
```
Fix TypeScript errors in zkLogin signing:
- Error: "Argument of type 'Transaction' is not assignable to parameter of type 'Uint8Array'"
- The signTransaction method expects serialized bytes, not a Transaction object
- Need to serialize the transaction first, then sign the bytes
```

**Result:** Changed from `ephemeralKey.signTransaction(tx)` to `ephemeralKey.sign(Buffer.from(transactionBlockSerialized, 'base64'))` with proper serialization

#### Prompt 3: Fixing getZkLoginSignature Parameters
**Prompt:**
```
Fix the getZkLoginSignature() call - it's missing required parameters:
- The Proving Service returns: proofPoints, issBase64Details, headerBase64, addressSeed
- Need to pass userSignature (from ephemeral key signing) and maxEpoch
- Structure the inputs object correctly for the SDK
```

**Result:** Updated parameter structure to match SDK requirements with proper `inputs` object containing proof data and `userSignature` + `maxEpoch` parameters

---

### P0-2: Enhanced Move 2024 Smart Contract

#### Prompt 4: Move 2024 Contract Enhancement
**Prompt:**
```
Upgrade the swap_helper.move contract to use Move 2024 syntax and advanced features:
1. Add AdminCap struct with key ability for access control
2. Create SwapRegistry with Tables for efficient on-chain storage
3. Add SwapRecord and UserStats structs for tracking
4. Implement events: SwapEvent, UserStatsUpdated, RegistryInitialized
5. Add functions: init_registry, execute_swap<T>, get_user_stats, get_registry_stats
6. Use generics, Tables, capabilities, and event emission
7. Ensure full Move 2024 compliance (edition = "2024")
```

**Result:** Expanded `swap_helper.move` with:
- AdminCap capability-based access control
- SwapRegistry with Table-based storage
- Comprehensive event system
- Generic swap execution with user statistics tracking
- Full Move 2024 syntax compliance

---

### Key Technical Implementations (Trae IDE Powered)

#### Prompt 5: Implementing Atomic On-Chain Analytics with PTB
**Context:**
We needed to record swap data on-chain, but the swap logic was handled by external SDKs (Cetus).

**Prompt:**
```
How can I record swap events on-chain when using the Cetus SDK?
I want to make sure every swap transaction also calls my Move contract `record_swap_event`.
Modify `buildSimpleSwapTx` to append a MoveCall to the transaction block.
```

**Result:**
- Implemented **Programmable Transaction Block (PTB)** logic in `frontend/src/utils/cetus.ts`.
- Appended `moveCall` to the *same* transaction object returned by the Aggregator/CLMM SDK.
- Achieved atomic execution of "Swap + Record".

#### Prompt 6: Enabling Testnet Aggregator Support
**Context:**
Initially, the Aggregator was only enabled for Mainnet.

**Prompt:**
```
Check if Cetus Aggregator SDK supports Testnet.
If yes, modify the `getSwapQuote` function to use Aggregator on Testnet as well.
Update the fallback logic to handle cases where Aggregator finds no routes.
```

**Result:**
- Researched and confirmed Testnet support.
- Refactored `getSwapQuote` to allow Aggregator execution on Testnet.
- Updated documentation to reflect the "Hybrid Routing" capability on both networks.

#### Prompt 7: Fixing Timestamp Display Bug
**Context:**
The Swap History was showing dates from 1970 because the contract recorded Epoch ID instead of Unix Timestamp.

**Prompt:**
```
The swap history shows incorrect dates.
The contract returns `timestamp` as Epoch (e.g., 100), but the frontend expects milliseconds.
Fix this in the frontend without redeploying the contract.
Use the system `timestampMs` from the event metadata if available.
```

**Result:**
- Updated `getSwapHistory` to prioritize `timestampMs` from the event indexer.
- Modified `SwapHistory.tsx` to intelligently detect and format both Epoch and Millisecond timestamps.

---

## 3. Code Generation & Refactoring

### Frontend Components
**Prompt:**
```
Create a Next.js Swap UI component with:
1. Token selection dropdowns (from/to tokens)
2. Amount input fields with balance display
3. Real-time quote fetching
4. Swap button with loading states
5. Success/error feedback
6. Integration with zkLogin and wallet connection
7. Responsive design with Tailwind CSS
```

**Result:** Implemented comprehensive swap interface in `frontend/src/app/page.tsx` with:
- Dual token selection with filtering
- Real-time quote updates
- Multiple authentication methods (Google + Wallet)
- Loading and error states
- Success feedback with transaction links

### Configuration Management
**Prompt:**
```
Create a network-aware configuration system for:
1. Token definitions (SUI, USDC, CETUS, wUSDC, MEME, IDOL_APPLE, IDOL_DGRAN)
2. Pool IDs for different networks (Mainnet vs Testnet)
3. Network endpoints and RPC URLs
4. Supported token pairs per network
```

**Result:** Implemented `frontend/src/utils/config.ts` with:
- Comprehensive token definitions
- Network-specific pool configurations
- Dynamic network selection
- Support for multiple token pairs

---

## 4. Documentation & Testing

### Prompt 8: Comprehensive README
**Prompt:**
```
Create a comprehensive README for hackathon submission that includes:
1. Project overview and key features
2. P0 milestone achievements (zkLogin + Move 2024)
3. Tech stack with versions
4. Project structure
5. Quick start guide
6. Configuration instructions
7. API reference
8. Troubleshooting guide
9. Testing instructions
```

**Result:** Created README documentation covering core features, setup steps, and configuration.

