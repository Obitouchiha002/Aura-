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

import { registerPlugin } from '@capacitor/core';

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

/* ── biometric ───────────────────────────────────────────────────────────── */

/**
 * Two implementations, picked by where the app is running.
 *
 * On the web the platform authenticator is reached through WebAuthn. Inside
 * the Android shell that is not an option: an Android WebView does not
 * implement WebAuthn at all — `window.PublicKeyCredential` is simply not
 * there — which is why the fingerprint worked in the browser and did nothing
 * in the APK. The shell goes through the native BiometricPrompt instead.
 *
 * Both answer the same question: is this the device's owner, right now. The
 * credential id below is a marker rather than a key, because the native
 * prompt has no credential to hand back — the OS keeps that to itself.
 */

const NATIVE_CREDENTIAL = 'native-biometric';

function isNativeShell(): boolean {
  return typeof window !== 'undefined'
    && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * The native biometric plugin, reached without a dynamic import.
 *
 * Loading the package lazily looked tidy and was the bug: on a device the
 * import of that chunk hung — never resolving, never rejecting — so the
 * settings row sat on "Checking…" forever while the plugin itself was
 * perfectly healthy. The diagnostics screen, which calls the bridge directly,
 * reported isAvailable=true on the very same phone at the same moment.
 *
 * registerPlugin is in @capacitor/core, which is already in the main bundle,
 * so there is no chunk to fetch and nothing to hang on. The name is the one
 * the plugin registers itself under natively.
 */
function nativeBiometry(): any {
  const bridged = (window as any).Capacitor?.Plugins?.BiometricAuthNative;
  return bridged || registerPlugin('BiometricAuthNative');
}

/**
 * Never let a native call strand the UI.
 *
 * A promise that neither resolves nor rejects leaves whatever is waiting on it
 * showing a spinner for the rest of the session, which is exactly what
 * happened here. Anything that cannot answer in a few seconds is treated as
 * unavailable.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

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
  if (isNativeShell()) return true;
  return typeof window !== 'undefined'
    && !!window.PublicKeyCredential
    && window.isSecureContext;
}

/**
 * Why biometric unlock can or cannot be offered here.
 *
 * A plain boolean was not enough: an app built before the biometric plugin
 * existed reported exactly the same "false" as a phone with no fingerprint
 * enrolled, and the settings screen told the owner of a perfectly good sensor
 * that they had not set one up. The reason is carried so the UI can say the
 * true thing.
 */
export type BiometricStatus =
  | { available: true; via: 'biometric' | 'device-credential' }
  | { available: false; reason: 'needs-newer-app' | 'not-enrolled' | 'unsupported' };

export async function checkBiometricStatus(): Promise<BiometricStatus> {
  if (isNativeShell()) {
    let result: any;
    try {
      result = await withTimeout(nativeBiometry().checkBiometry(), 5000);
    } catch {
      // The plugin is not in this build of the shell. Nothing the phone can
      // do about it — the app itself has to be updated.
      return { available: false, reason: 'needs-newer-app' };
    }
    if (result?.isAvailable) return { available: true, via: 'biometric' };
    // The prompt is asked for with allowDeviceCredential, so a screen lock is
    // enough even with no finger or face enrolled.
    if (result?.deviceIsSecure) return { available: true, via: 'device-credential' };
    return { available: false, reason: 'not-enrolled' };
  }

  if (!isBiometricPossible()) return { available: false, reason: 'unsupported' };
  try {
    const ok = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return ok
      ? { available: true, via: 'biometric' }
      : { available: false, reason: 'not-enrolled' };
  } catch {
    return { available: false, reason: 'unsupported' };
  }
}

/** Is there actually a fingerprint/face sensor wired up on this device? */
export async function hasBiometricSensor(): Promise<boolean> {
  return (await checkBiometricStatus()).available;
}

/**
 * Registers this device's biometric. There is no server to verify against —
 * the guarantee here is "the same device, unlocked by its owner", which is
 * what an app lock needs. It is a second door on top of the code, not a
 * replacement for account auth.
 */
export async function registerBiometric(userLabel: string): Promise<string> {
  // Native has nothing to register: the sensor is already enrolled at the OS
  // level. Prompting once is still worth it — it proves the sensor works and
  // it is enrolled before the setting is switched on, so the user cannot end
  // up with an unlock method that fails the first time they rely on it.
  if (isNativeShell()) {
    await nativeBiometry().authenticate({
      reason: 'Confirm it is you, so this can unlock Aura.',
      androidTitle: 'Unlock Aura',
      androidSubtitle: 'Use your fingerprint or face',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
    });
    return NATIVE_CREDENTIAL;
  }

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
  // A lock set up in the browser and then opened in the shell — or the other
  // way round — has the wrong kind of credential for where it is now. Falling
  // through to the wrong implementation would throw; going by where we are
  // running keeps the code as the way in.
  if (isNativeShell() || credentialId === NATIVE_CREDENTIAL) {
    if (!isNativeShell()) return false;
    try {
      await nativeBiometry().authenticate({
        reason: 'Unlock Aura',
        androidTitle: 'Unlock Aura',
        androidSubtitle: 'Use your fingerprint or face',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
      });
      return true;
    } catch {
      // Cancelled, not recognised, or locked out after too many tries. The
      // code entry stays on screen either way.
      return false;
    }
  }

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
