/**
 * App lock — PIN, passcode, pattern and biometric.
 *
 * Secrets are never stored. A PIN/passcode/pattern is salted and hashed with
 * SHA-256 through WebCrypto, and only the salt + hash go to localStorage, so
 * reading storage does not reveal the code.
 *
 * Biometric uses WebAuthn's platform authenticator (Touch ID, Face ID, Windows
 * Hello, Android fingerprint). WebAuthn requires a secure context: it works on
 * localhost and on HTTPS, and is simply unavailable over plain HTTP.
 */

export type LockMethod = 'pin' | 'passcode' | 'pattern';

export interface LockConfig {
  enabled: boolean;
  method: LockMethod;
  salt: string;
  hash: string;
  /** Minutes of being away before it locks again. 0 = every time. */
  autoLockMinutes: number;
  biometric: boolean;
  /** WebAuthn credential id, base64url. */
  credentialId?: string;
}

const KEY = 'aura_lock';
const LAST_ACTIVE_KEY = 'aura_lock_last_active';

/* ── hashing ─────────────────────────────────────────────────────────────── */

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

/** WebCrypto only exists in a secure context — HTTPS or localhost. */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  if (!isCryptoAvailable()) {
    // Better to refuse than to silently fall back to something weaker.
    throw new Error('App lock needs a secure connection (HTTPS or localhost).');
  }
  const data = new TextEncoder().encode(`${salt}:${secret}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

/** Constant-time-ish compare, so a wrong code cannot be timed character by character. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── storage ─────────────────────────────────────────────────────────────── */

export function readConfig(): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.enabled && parsed?.hash ? parsed as LockConfig : null;
  } catch {
    return null;
  }
}

export function writeConfig(config: LockConfig | null): void {
  try {
    if (config) localStorage.setItem(KEY, JSON.stringify(config));
    else localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('Could not persist the app lock', e);
  }
}

export async function createConfig(
  method: LockMethod,
  secret: string,
  autoLockMinutes = 0
): Promise<LockConfig> {
  const salt = randomSalt();
  return {
    enabled: true,
    method,
    salt,
    hash: await hashSecret(secret, salt),
    autoLockMinutes,
    biometric: false,
  };
}

export async function verifySecret(config: LockConfig, secret: string): Promise<boolean> {
  return safeEqual(await hashSecret(secret, config.salt), config.hash);
}

/* ── auto-lock ───────────────────────────────────────────────────────────── */

export function markActive(): void {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
}

/** Should the app be locked right now, given how long it has been away? */
export function shouldLock(config: LockConfig): boolean {
  if (config.autoLockMinutes <= 0) return true;
  try {
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
    if (!last) return true;
    return Date.now() - last > config.autoLockMinutes * 60_000;
  } catch {
    return true;
  }
}

/* ── biometric (WebAuthn) ────────────────────────────────────────────────── */

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function isBiometricPossible(): boolean {
  return typeof window !== 'undefined'
    && !!window.PublicKeyCredential
    && window.isSecureContext;
}

/** Is there actually a fingerprint/face sensor wired up on this device? */
export async function hasBiometricSensor(): Promise<boolean> {
  if (!isBiometricPossible()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers this device's biometric. There is no server to verify against —
 * the guarantee here is "the same device, unlocked by its owner", which is
 * what an app lock needs. It is a second door on top of the code, not a
 * replacement for account auth.
 */
export async function registerBiometric(userLabel: string): Promise<string> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Aura', id: window.location.hostname },
      user: { id: userId, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },    // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric setup was cancelled.');
  return b64url(credential.rawId);
}

export async function verifyBiometric(credentialId: string): Promise<boolean> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
      rpId: window.location.hostname,
    },
  });

  return !!assertion;
}
