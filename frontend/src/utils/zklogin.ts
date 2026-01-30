import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness } from '@mysten/zklogin';

// ⚠️ Replace with your actual Google Client ID
// For local dev (localhost:3000), you can use this demo ID or create your own at console.cloud.google.com
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '25769832374-famec85nbqn6hskd94n6d846g4869051.apps.googleusercontent.com'; 
export const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;

export const KEY_PAIR_SESSION_KEY = 'zklogin_ephemeral_key';
export const RANDOMNESS_SESSION_KEY = 'zklogin_randomness';
export const MAX_EPOCH_KEY = 'zklogin_max_epoch';

export function setupEphemeralKey() {
    const ephemeralKeyPair = new Ed25519Keypair();
    const randomness = generateRandomness();
    
    // Store in Session Storage (safer than LocalStorage for keys, though ephemeral)
    window.sessionStorage.setItem(KEY_PAIR_SESSION_KEY, ephemeralKeyPair.getSecretKey());
    window.sessionStorage.setItem(RANDOMNESS_SESSION_KEY, randomness);
    
    return {
        ephemeralKeyPair,
        randomness
    };
}

export function getEphemeralKey() {
    const privateKey = window.sessionStorage.getItem(KEY_PAIR_SESSION_KEY);
    if (!privateKey) return null;
    return Ed25519Keypair.fromSecretKey(privateKey);
}

export function getGoogleLoginUrl(epoch: number) {
    const { ephemeralKeyPair, randomness } = setupEphemeralKey();
    
    // Expiry: Current Epoch + 2 (approx 48 hours)
    const maxEpoch = epoch + 2; 
    window.sessionStorage.setItem(MAX_EPOCH_KEY, String(maxEpoch));

    const nonce = generateNonce(
        ephemeralKeyPair.getPublicKey(), 
        maxEpoch, 
        randomness
    );

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: REDIRECT_URI,
        scope: 'openid email profile',
        nonce: nonce, // Important: Binds the ephemeral key to the JWT
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function clearZkLoginSession() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(KEY_PAIR_SESSION_KEY);
    window.sessionStorage.removeItem(RANDOMNESS_SESSION_KEY);
    window.sessionStorage.removeItem(MAX_EPOCH_KEY);
}
