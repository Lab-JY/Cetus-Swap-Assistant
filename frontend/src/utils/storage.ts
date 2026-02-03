
// Simple secure storage wrapper with expiration and obfuscation
// Note: This is client-side obfuscation, not military-grade encryption.

const PREFIX = 'zk_sec_';
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StorageItem<T> {
    value: T;
    expiry: number;
}

// Simple XOR obfuscation with a static key (Client-side only)
const SECRET_KEY = 'sui_hack_frontend_secret';

function obfuscate(input: string): string {
    let result = '';
    for (let i = 0; i < input.length; i++) {
        result += String.fromCharCode(input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
    }
    return btoa(result); // Base64 encode
}

function deobfuscate(input: string): string {
    try {
        const decoded = atob(input);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return result;
    } catch (e) {
        console.error("Failed to deobfuscate storage item", e);
        return '';
    }
}

export const secureStorage = {
    setItem: <T>(key: string, value: T, ttlMs: number = DEFAULT_EXPIRY_MS) => {
        if (typeof window === 'undefined') return;
        
        const item: StorageItem<T> = {
            value,
            expiry: Date.now() + ttlMs
        };
        
        const jsonStr = JSON.stringify(item);
        const encrypted = obfuscate(jsonStr);
        window.sessionStorage.setItem(PREFIX + key, encrypted);
    },

    getItem: <T>(key: string): T | null => {
        if (typeof window === 'undefined') return null;

        const encrypted = window.sessionStorage.getItem(PREFIX + key);
        if (!encrypted) return null;

        try {
            const jsonStr = deobfuscate(encrypted);
            if (!jsonStr) return null;

            const item: StorageItem<T> = JSON.parse(jsonStr);
            
            if (Date.now() > item.expiry) {
                window.sessionStorage.removeItem(PREFIX + key);
                return null;
            }

            return item.value;
        } catch (e) {
            console.error("Storage parse error", e);
            return null;
        }
    },

    removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.removeItem(PREFIX + key);
    },
    
    clear: () => {
        if (typeof window === 'undefined') return;
        Object.keys(window.sessionStorage).forEach(key => {
            if (key.startsWith(PREFIX)) {
                window.sessionStorage.removeItem(key);
            }
        });
    }
};
