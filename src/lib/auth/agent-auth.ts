/**
 * Agent Authentication Utilities
 * Optimized for Edge Runtime (uses Web Crypto API instead of node:crypto)
 */

export function generateApiKey() {
    // 1. Generate 32 random bytes using Web Crypto
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    // 2. Convert to 64-character hex string
    const hex = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // 3. Prepend "sw_agent_" prefix
    return `sw_agent_${hex}`;
}

export async function hashApiKey(apiKey: string) {
    // 4. Compute SHA-256 hash using Web Crypto (SubtleCrypto)
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // 5. Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getApiKeyPrefix(apiKey: string) {
    // 6. First 14 chars for display
    return apiKey.substring(0, 14);
}

export function validateApiKeyFormat(apiKey: string) {
    return apiKey.startsWith('sw_agent_') && apiKey.length === 73;
}
