import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for mailbox secrets (SMTP passwords, OAuth tokens).
 * AES-256-GCM. The key is derived by SHA-256 of MAILBOX_ENCRYPTION_KEY, so any
 * passphrase works. Ciphertext format: base64(iv).base64(tag).base64(cipher).
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error('MAILBOX_ENCRYPTION_KEY is not set — cannot store mailbox secrets');
  }
  return createHash('sha256').update(raw).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed mailbox secret ciphertext');
  }
  const [ivB64, tagB64, encB64] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** True when a MAILBOX_ENCRYPTION_KEY is configured. */
export function encryptionConfigured(): boolean {
  return Boolean(process.env.MAILBOX_ENCRYPTION_KEY?.trim());
}
