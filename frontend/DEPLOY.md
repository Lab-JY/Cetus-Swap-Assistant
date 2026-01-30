# 🚀 Deployment Guide (Vercel)

Deploying your dApp to Vercel is the best way to test Mainnet features (like zkLogin) and share your project.

## 1. Push to GitHub
Make sure your latest code is pushed to your GitHub repository.

## 2. Deploy on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your `sui-hack` repository.
3. Select `frontend` as the **Root Directory** (Important!).
4. Select `Next.js` as the Framework Preset (Auto-detected).

## 3. Configure Environment Variables
In the "Environment Variables" section of the deployment screen, add the following:

| Name | Value (Mainnet) |
|------|-----------------|
| `NEXT_PUBLIC_SUI_NETWORK` | `mainnet` |
| `NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID` | `0x3165544e38f9baf1a897d2660a2a545f9634862417444c63c9f401da8b67a331` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `96407708019-pkjplel118bu7v1uncv6ji0g1ms7bb3g.apps.googleusercontent.com` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` (Update this after deploy!) |

> **Note on APP_URL**: For zkLogin to work, you must update the `NEXT_PUBLIC_APP_URL` to your actual Vercel domain once generated. You also need to add this Vercel domain to your Google Cloud Console "Authorized redirect URIs".

## 4. Deploy
Click **Deploy**. Vercel will build your app and provide a live URL within minutes.

## 5. Post-Deployment (zkLogin)
1. Copy your new Vercel URL (e.g., `https://sui-hack-frontend.vercel.app`).
2. Go to Google Cloud Console -> Credentials.
3. Edit your OAuth 2.0 Client ID.
4. Add `https://sui-hack-frontend.vercel.app/auth/callback` to **Authorized redirect URIs**.
