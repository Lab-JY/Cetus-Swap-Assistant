import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, getZkLoginSignature } from '@mysten/zklogin';
import { Transaction } from '@mysten/sui/transactions';

// ⚠️ Replace with your actual Google Client ID
// For local dev (localhost:3000), you can use this demo ID or create your own at console.cloud.google.com
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '25769832374-famec85nbqn6hskd94n6d846g4869051.apps.googleusercontent.com';
export const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback`;

// Official Sui Proving Service endpoint
export const PROVING_SERVICE_URL = 'https://prover.mystenlabs.com/v1';

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

/**
 * Call the official Sui Proving Service to get ZK proof
 * This is required to sign transactions with zkLogin
 */
export async function getZkProofFromProvingService(jwt: string): Promise<any> {
    try {
        console.log('🔐 Calling Sui Proving Service to generate ZK proof...');

        const ephemeralKey = getEphemeralKey();
        const randomness = window.sessionStorage.getItem(RANDOMNESS_SESSION_KEY);
        const maxEpoch = window.sessionStorage.getItem(MAX_EPOCH_KEY);

        if (!ephemeralKey || !randomness || !maxEpoch) {
            throw new Error('Missing ephemeral key or session data');
        }

        const response = await fetch(`${PROVING_SERVICE_URL}/prove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jwt: jwt,
                ephemeralPublicKey: ephemeralKey.getPublicKey().toSuiPublicKey(),
                randomness: randomness,
                maxEpoch: parseInt(maxEpoch),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Proving Service error: ${error}`);
        }

        const zkProof = await response.json();
        console.log('✅ ZK proof generated successfully');
        return zkProof;
    } catch (error) {
        console.error('❌ Error getting ZK proof from Proving Service:', error);
        throw error;
    }
}

/**
 * Sign a transaction using zkLogin
 * This creates a zkLogin signature that can be submitted to Sui network
 */
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
        const maxEpochStr = window.sessionStorage.getItem(MAX_EPOCH_KEY);
        if (!maxEpochStr) {
            throw new Error('Max epoch not found in session');
        }
        const maxEpoch = parseInt(maxEpochStr);

        // Serialize the transaction
        const transactionBlockSerialized = tx.serialize();

        // Sign the serialized transaction bytes with ephemeral key
        const signatureBytes = await ephemeralKey.sign(Buffer.from(transactionBlockSerialized, 'base64'));

        // Create zkLogin signature using the proof from Proving Service
        const zkLoginSignature = getZkLoginSignature({
            inputs: {
                proofPoints: zkProof.proofPoints,
                issBase64Details: zkProof.issBase64Details,
                headerBase64: zkProof.headerBase64,
                addressSeed: zkProof.addressSeed,
            },
            userSignature: signatureBytes,
            maxEpoch: maxEpoch,
        });

        console.log('✅ Transaction signed with zkLogin');

        return {
            transactionBlockSerialized,
            signature: zkLoginSignature,
        };
    } catch (error) {
        console.error('❌ Error signing transaction with zkLogin:', error);
        throw error;
    }
}
