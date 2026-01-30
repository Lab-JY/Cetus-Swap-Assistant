# 🤖 AI Usage Disclosure

In compliance with the **Sui Vibe Hackathon 2026** rules (Requirement #6), we hereby fully disclose the use of Artificial Intelligence tools in the development of this project.

---

## 1. AI Tools Used

| Tool Name | Model / Version | Usage |
| :--- | :--- | :--- |
| **Claude Code** | Claude Haiku 4.5 (claude-haiku-4-5-20251001) | Code generation, debugging, refactoring, problem-solving, and documentation writing |
| **Google Gemini** | Gemini 3 Pro | Code analysis, architectural design, and complex problem-solving |
| **Trae IDE** | Gemini-3-Pro-Preview | Pair programming, code generation, and project structure setup |
| **GitHub Copilot** | GPT-5.2-Codex | Inline code completion and boilerplate generation |

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

**Result:** Expanded `swap_helper.move` from 34 lines to 205 lines with:
- AdminCap capability-based access control
- SwapRegistry with Table-based storage
- Comprehensive event system
- Generic swap execution with user statistics tracking
- Full Move 2024 syntax compliance

---

### Bug Fixes & Optimization

#### Prompt 5: Fixing UnusedValueWithoutDrop Error
**Prompt:**
```
Fix the error: "UnusedValueWithoutDrop { result_idx: 3, secondary_idx: 0 }"
This occurs on wUSDC → USDC swaps with wallet connection.
The issue is that a Transaction object is created but never used in CLMM mode.
The CLMM SDK creates its own transaction, leaving the original tx unused.
Solution: Make tx nullable and only create it when needed for Aggregator mode.
```

**Result:**
- Changed `tx: Transaction` to `tx: Transaction | null` in `buildSimpleSwapTx()`
- Only create tx when `quote.source !== 'clmm'`
- CLMM mode creates its own transaction via `cetusClmm.Swap.createSwapTransactionPayload()`

#### Prompt 6: Hybrid Routing Engine Optimization
**Prompt:**
```
Optimize the hybrid routing logic in cetus.ts:
1. Primary: Try Cetus Aggregator SDK for multi-hop routes (Mainnet only)
2. Fallback: Use direct CLMM pool interaction if Aggregator fails or on Testnet
3. Handle transaction object lifecycle properly based on routing mode
4. Provide clear error messages for unsupported token pairs
5. Implement price impact protection (disable swap if > 5%)
```

**Result:** Implemented complete hybrid routing system with:
- Automatic fallback from Aggregator to CLMM
- Proper transaction management based on routing mode
- Comprehensive error handling
- Support for multiple token pairs on both networks

#### Prompt 8: Fixing Pyth Price Nodes Configuration
**Prompt:**
```
Fix the error: "All Pyth price nodes are unavailable. Cannot fetch price data."
The Cetus Aggregator SDK requires Pyth price node URLs to be configured.
Add pythUrls parameter to AggregatorClient initialization with fallback Pyth nodes:
- https://hermes.pyth.network
- https://hermes-beta.pyth.network
```

**Result:** Updated AggregatorClient initialization in `frontend/src/utils/cetus.ts:11-18` to include:
```typescript
pythUrls: [
    'https://hermes.pyth.network',
    'https://hermes-beta.pyth.network'
]
```
This ensures price data can be fetched even if one Pyth node is unavailable.

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

### Prompt 7: Comprehensive README
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

**Result:** Created detailed README.md with:
- Hackathon achievement highlights
- Complete feature documentation
- API reference for all key functions
- Deployment and testing instructions
- Troubleshooting section

---

## 5. Human Verification & Modifications

All AI-generated code was thoroughly reviewed, tested, and modified by human developers to ensure:

✅ **Correctness**: All functions tested and verified to work correctly
✅ **Security**: No vulnerabilities introduced; proper error handling implemented
✅ **Alignment**: Code aligns with project architecture and hackathon requirements
✅ **Move 2024 Compliance**: Smart contract uses latest Move syntax (edition = "2024")
✅ **Best Practices**: Follows Sui ecosystem conventions and patterns

### Key Human Decisions:
- Chose official Sui Proving Service over alternative approaches
- Designed hybrid routing engine architecture
- Implemented transaction lifecycle management for CLMM vs Aggregator modes
- Structured on-chain analytics with Tables and events
- Prioritized user experience with frictionless Google login

---

## 6. Summary

| Phase | AI Contribution | Human Contribution |
| :--- | :--- | :--- |
| **P0-1: zkLogin** | Generated initial integration code | Debugged TypeScript errors, fixed SDK parameter structures |
| **P0-2: Move 2024** | Generated contract structure | Designed advanced features, ensured compliance |
| **Bug Fixes** | Suggested solutions | Implemented and tested fixes |
| **Documentation** | Generated initial drafts | Reviewed, enhanced, and finalized |
| **Architecture** | Provided implementation patterns | Designed overall system architecture |

---

## 7. Conclusion

AI tools were used to perform the majority of development work, with human developers providing direction, oversight, and final validation. The human role focused on issuing requirements and commands, while AI tools handled code generation, debugging, refactoring, and documentation. The project demonstrates responsible AI usage in hackathon development with full transparency and compliance with hackathon rules.

**AI Usage Percentage**: ~75% AI implementation, ~25% human direction and validation
