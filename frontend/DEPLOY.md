## 🚀 Deployment Guide (Vercel & Railway)

Deploying your dApp to cloud platforms allows you to test Mainnet features (like zkLogin) and share your project.

### Option 1: Vercel (Recommended for Next.js)

1. **Push to GitHub**: Ensure code is in your repo.
2. **Import**: Go to [Vercel Dashboard](https://vercel.com/new) -> Import repo.
3. **Settings**:
   - Root Directory: `frontend`
   - Framework: `Next.js`
4. **Environment Variables**:
   See the [Environment Variables](#environment-variables) section below.

---

### Option 2: Railway (Docker)

This project includes a production-ready `Dockerfile` optimized for Next.js standalone output.

1. **Push to GitHub**: Ensure code is in your repo.
2. **New Project**: Go to [Railway Dashboard](https://railway.app/new) -> "Deploy from GitHub repo".
3. **Configure**:
   - Select your repo.
   - **Important**: Do NOT set "Root Directory" to `/frontend` if you are using `railway.json`.
   - Instead, let Railway use the root context, but specify the Dockerfile path in `railway.json`.
   - If you manually set Root Directory to `/frontend`, Docker might fail to find files because the context is shifted.
   - **Recommended**: Leave Root Directory as `/` (default) and use the `railway.json` included in this repo.
4. **Variables**:
   - Go to the "Variables" tab.
   - Add the variables listed below.
   - **Important**: In Railway, build-time variables (ARG) must also be set in the Variables tab.
5. **Domain**:
   - Go to Settings -> Networking -> Generate Domain (e.g., `xxx.up.railway.app`).
   - Update `NEXT_PUBLIC_APP_URL` variable with this new domain.

---

### Environment Variables

Add these to your deployment platform (Vercel or Railway):

| Name | Value (Mainnet) |
|------|-----------------|
| `NEXT_PUBLIC_SUI_NETWORK` | `mainnet` |
| `NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID` | `0x3165544e38f9baf1a897d2660a2a545f9634862417444c63c9f401da8b67a331` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `96407708019-pkjplel118bu7v1uncv6ji0g1ms7bb3g.apps.googleusercontent.com` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app-url.com` (Update after deploy!) |

> **Important for zkLogin**: 
> 1. Get your deployed URL (e.g., `https://sui-hack.up.railway.app`).
> 2. Update `NEXT_PUBLIC_APP_URL` variable.
> 3. Go to Google Cloud Console -> Credentials.
> 4. Add `https://sui-hack.up.railway.app/auth/callback` to **Authorized redirect URIs**.

