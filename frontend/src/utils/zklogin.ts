import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, getZkLoginSignature } from '@mysten/sui/zklogin';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { secureStorage } from './storage';
import { SUI_NETWORK } from './config';

// ⚠️ Replace with your actual Google Client ID
// For local dev (localhost:3000), you can use this demo ID or create your own at console.cloud.google.com
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '25769832374-famec85nbqn6hskd94n6d846g4869051.apps.googleusercontent.com';
export const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;

// Official Sui Proving Service endpoint
export const PROVING_SERVICE_URL = 'https://prover.mystenlabs.com/v1';

export const KEY_PAIR_SESSION_KEY = 'zklogin_ephemeral_key';
export const RANDOMNESS_SESSION_KEY = 'zklogin_randomness';
export const MAX_EPOCH_KEY = 'zklogin_max_epoch';

export function setupEphemeralKey() {
    const ephemeralKeyPair = new Ed25519Keypair();
    const randomness = generateRandomness();
    
    // Store in Secure Session Storage
    secureStorage.setItem(KEY_PAIR_SESSION_KEY, ephemeralKeyPair.getSecretKey());
    secureStorage.setItem(RANDOMNESS_SESSION_KEY, randomness);
    
    return {
        ephemeralKeyPair,
        randomness
    };
}

export function getEphemeralKey() {
    const privateKey = secureStorage.getItem<string>(KEY_PAIR_SESSION_KEY);
    if (!privateKey) return null;
    return Ed25519Keypair.fromSecretKey(privateKey);
}

export function getGoogleLoginUrl(epoch: number) {
    const { ephemeralKeyPair, randomness } = setupEphemeralKey();
    
    // Expiry: Current Epoch + 2 (approx 48 hours)
    const maxEpoch = epoch + 2; 
    secureStorage.setItem(MAX_EPOCH_KEY, String(maxEpoch));

    const nonce = generateNonce(
        ephemeralKeyPair.getPublicKey(), 
        maxEpoch, 
        randomness
    );

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: nonce,
        prompt: 'select_account'
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function clearZkLoginSession() {
    secureStorage.removeItem(KEY_PAIR_SESSION_KEY);
    secureStorage.removeItem(RANDOMNESS_SESSION_KEY);
    secureStorage.removeItem(MAX_EPOCH_KEY);
    secureStorage.removeItem('zklogin_jwt');
    secureStorage.removeItem('zklogin_salt');
    secureStorage.removeItem('zklogin_address');
}

export async function getZkProofFromProvingService(jwt: string) {
    try {
        console.log('🔐 Calling Sui Proving Service to generate ZK proof...');

        const ephemeralKey = getEphemeralKey();
        const randomness = secureStorage.getItem<string>(RANDOMNESS_SESSION_KEY);
        const maxEpoch = secureStorage.getItem<string>(MAX_EPOCH_KEY);
        const salt = secureStorage.getItem<string>('zklogin_salt');

        if (!ephemeralKey || !randomness || !maxEpoch || !salt) {
            throw new Error('Missing ephemeral key or session data');
        }

        const response = await fetch(PROVING_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jwt,
                extendedEphemeralPublicKey: ephemeralKey.getPublicKey().toSuiPublicKey(),
                maxEpoch: Number(maxEpoch),
                jwtRandomness: randomness,
                salt: salt,
                keyClaimName: 'sub'
            })
        });

        if (!response.ok) {
            throw new Error(`Proving Service failed: ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Proving Service Error:', error);
        throw error;
    }
}

export async function signTransactionWithZkLogin(
    tx: Transaction,
    jwt: string
): Promise<{ transactionBlockSerialized: string; signature: string }> {
    try {
        console.log('🔐 Signing transaction with zkLogin...');

        // Get ZK proof from Proving Service
        const zkProof = await getZkProofFromProvingService(jwt);

        // Get ephemeral key for signing
        const ephemeralKey = getEphemeralKey();
        if (!ephemeralKey) {
            throw new Error('Ephemeral key not found');
        }

        // Get maxEpoch from session
        const maxEpochStr = secureStorage.getItem<string>(MAX_EPOCH_KEY);
        if (!maxEpochStr) {
            throw new Error('Max epoch not found in session');
        }

        // Initialize client to build transaction
        const client = new SuiClient({ 
            url: SUI_NETWORK === 'mainnet' 
                ? 'https://fullnode.mainnet.sui.io' 
                : 'https://fullnode.testnet.sui.io' 
        });

        // Sign with ephemeral key
        const { bytes, signature: userSignature } = await tx.sign({
            client,
            signer: ephemeralKey
        });

        // Generate zkLogin signature
        const zkLoginSignature = getZkLoginSignature({
            inputs: zkProof,
            maxEpoch: Number(maxEpochStr),
            userSignature,
        });

        return {
            transactionBlockSerialized: bytes,
            signature: zkLoginSignature
        };

    } catch (error) {
        console.error('Sign with zkLogin Error:', error);
        throw error;
    }
}
