/**
 * PBKDF2 Password Hashing (Edge-compatible, Web Crypto API)
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const ALGORITHM = 'PBKDF2';
const HASH = 'SHA-256';

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        ALGORITHM,
        false,
        ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: ALGORITHM, salt, iterations: ITERATIONS, hash: HASH },
        keyMaterial,
        KEY_LENGTH * 8,
    );
    const saltHex = toHex(salt);
    const hashHex = toHex(new Uint8Array(derivedBits));
    return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [saltHex, expectedHashHex] = stored.split(':');
    if (!saltHex || !expectedHashHex) return false;

    const salt = fromHex(saltHex);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        ALGORITHM,
        false,
        ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: ALGORITHM, salt: salt as BufferSource, iterations: ITERATIONS, hash: HASH },
        keyMaterial,
        KEY_LENGTH * 8,
    );
    const hashHex = toHex(new Uint8Array(derivedBits));
    return hashHex === expectedHashHex;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
