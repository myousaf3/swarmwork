/**
 * AES-256-GCM encryption/decryption for LLM API keys.
 * Uses Web Crypto API for edge-runtime compatibility.
 * Requires ENCRYPTION_KEY (64-char hex = 32 bytes) in environment.
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const TAG_LENGTH = 128; // bits

function getKeyBytes(): ArrayBuffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes.buffer as ArrayBuffer;
}

async function getCryptoKey(): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        getKeyBytes(),
        { name: ALGORITHM },
        false,
        ['encrypt', 'decrypt'],
    );
}

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function fromHex(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes.buffer as ArrayBuffer;
}

/**
 * Encrypt plaintext → "iv:ciphertext" (hex-encoded).
 * GCM tag is appended to ciphertext by Web Crypto.
 */
export async function encrypt(plaintext: string): Promise<string> {
    const key = await getCryptoKey();
    const ivArr = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const iv = ivArr.buffer as ArrayBuffer;
    const encoded = new TextEncoder().encode(plaintext);

    const cipherBuf = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
        key,
        encoded,
    );

    return `${toHex(iv)}:${toHex(cipherBuf)}`;
}

/**
 * Decrypt "iv:ciphertext" → plaintext.
 */
export async function decrypt(encrypted: string): Promise<string> {
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!ivHex || !cipherHex) {
        throw new Error('Invalid encrypted format — expected "iv:ciphertext"');
    }

    const key = await getCryptoKey();

    const plainBuf = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: fromHex(ivHex), tagLength: TAG_LENGTH },
        key,
        fromHex(cipherHex),
    );

    return new TextDecoder().decode(plainBuf);
}
