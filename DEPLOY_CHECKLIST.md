# Deployment Checklist for Sui Vibe Hackathon

Your code is **Feature Complete**! However, to meet the "Runnable Product" requirement, you must perform these final deployment steps.

## 1. Deploy Smart Contract (Critical)

You must deploy the Move contract to **Sui Testnet**.

1.  Open your terminal.
2.  Switch to the contract directory:
    ```bash
    cd contracts/suipay
    ```
3.  Ensure you have SUI tokens (request from Discord faucet or wallet).
4.  Publish the contract:
    ```bash
    sui client publish --gas-budget 100000000
    ```
5.  **Copy the Package ID** from the output (look for `Immutable` or the first object ID).

## 2. Connect Frontend to Contract

1.  Open `frontend/src/app/pay/[orderId]/page.tsx`.
2.  Find line 10:
    ```typescript
    const SUIPAY_PACKAGE_ID = '0x123...456'; 
    ```
3.  Replace `'0x123...456'` with your **actual Package ID** from Step 1.
4.  Commit and push the change to GitHub.

## 3. Go Live (Frontend)

Deploy your frontend to Vercel (recommended for Next.js).

1.  Push your code to GitHub.
2.  Go to [Vercel](https://vercel.com).
3.  Import your repository.
4.  Deploy! (The build command `npm run build` is already verified to pass).

## 4. Run Backend (Optional for Demo)

For the hackathon demo video, running the backend locally is acceptable if you show it working.

1.  Ensure Docker is running.
2.  Start the database:
    ```bash
    cd backend
    docker-compose up -d
    ```
3.  Run the indexer:
    ```bash
    cargo run
    ```

## 5. Record Your Demo Video

- Show the **"Pay with SUI"** flow swapping to USDC.
- Show the **"StableLayer Yield"** badge appearing after payment.
- Explain that the contract holds the funds and routes them to yield protocols.

**Good Luck! 🌊**
