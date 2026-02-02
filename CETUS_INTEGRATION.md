# 🌊 Cetus Protocol Deep Integration Showcase

This project is built as a native application on top of the **Cetus Protocol**, leveraging its powerful liquidity infrastructure and aggregator SDKs to provide seamless "Swap & Send" (Zap) functionality.

## 🛠️ Integration Architecture

We integrate Cetus at two distinct layers:

### 1. Smart Aggregator (Routing)
We use the **Cetus Aggregator SDK** (`@cetusprotocol/aggregator-sdk`) to find the most efficient trading paths across the entire Sui liquidity network.

*   **Implementation**: `frontend/src/utils/cetus.ts` -> `getSwapQuote`
*   **Key Feature**: `aggregator.findRouters`
*   **Value**: Automatically compares direct pool swaps vs. multi-hop routes to ensure users get the best possible execution price (Amount Out).

### 2. CLMM Liquidity Pools (Execution)
For direct execution or specific pool interactions, we utilize the **Cetus CLMM SDK** (`@cetusprotocol/cetus-sui-clmm-sdk`).

*   **Implementation**: `frontend/src/utils/cetus.ts` -> `buildSimpleSwapTx`
*   **Key Feature**: `cetusClmm.Swap.createSwapTransactionPayload`
*   **Value**: Provides robust, low-level access to Concentrated Liquidity Market Maker pools for highly efficient swaps.

## 🚀 Key Feature: "Zap" (Convert & Send)

We built a unique user experience on top of Cetus: **Cross-Currency Transfers**.

### Problem
Users often hold `SUI` but want to pay someone in `USDC`. Typically, this requires:
1.  Go to a DEX.
2.  Swap SUI -> USDC.
3.  Go to Wallet.
4.  Send USDC to recipient.

### Our Solution (Zap Mode)
We streamlined this into a unified flow within a single interface:

1.  **Unified UI**: User selects "Pay: SUI" and "Receive: USDC".
2.  **Auto-Detection**: System detects cross-currency intent and activates "Zap Mode".
3.  **Cetus Power**: Instantly fetches a quote via Cetus Aggregator.
4.  **Execution**: 
    *   **Step 1**: Executes Swap via Cetus Router.
    *   **Step 2**: Automatically prompts to transfer the resulting USDC to the recipient.

> **Note on Atomicity**: While we currently use a safe "Two-Step" signature flow to ensure asset safety with the high-level SDK, the logic is tightly coupled to Cetus's output.

## 📊 On-Chain Analytics

Every transaction performed through our app is tagged with a custom **On-Chain Event** (`SwapEvent`), allowing for:
*   Real-time tracking of volume generated for Cetus.
*   User-specific trading history entirely derived from chain data (no local database).

## 💻 Code Highlights

### Aggregator Integration
```typescript
// utils/cetus.ts

const aggregator = new AggregatorClient({
    endpoint: SUI_NETWORK === 'mainnet' ? 'https://api-sui.cetus.zone/router_v3/find_routes' : undefined,
    // ...
});

export async function getSwapQuote(...) {
    // Dynamic Routing
    const routerData = await aggregator.findRouters({
        from: fromCoinType,
        target: toCoinType,
        amount: amount,
        // ...
    });
    // ...
}
```

### Transaction Building
```typescript
// utils/cetus.ts

export async function buildSimpleSwapTx(...) {
    if (quote.source === 'aggregator') {
        // Execute via Cetus Aggregator Router
        await aggregator.routerSwap({
            router: router,
            txb: tx,
            // ...
        });
    } else {
        // Execute via Direct CLMM Pool
        // ...
    }
}
```
