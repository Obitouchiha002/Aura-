/**
 * Haptics.
 *
 * The whole app used to fire the same `navigator.vibrate(50)` for everything,
 * which reads as one blunt buzz rather than feedback. These are short, layered
 * patterns modelled on the iOS taxonomy: a light tick for selection, a firmer
 * one for a committed action, and multi-pulse patterns for outcomes.
 *
 * Inside the Android shell none of this reached the phone. `navigator.vibrate`
 * needs the VIBRATE permission, the app never declared it, and the call fails
 * silently — so haptics worked in a browser and did nothing in the APK. The
 * shell now goes through the OS haptics API instead, which is both permitted
 * and better tuned than a raw vibration pattern.
 *
 * Support note: `navigator.vibrate` is Android/Chrome only. iOS Safari does not
 * expose the Taptic Engine to web pages at all, so on an iPhone the web path is
 * a no-op — there is no web API that can reach it. `isHapticsSupported` exists
 * so the UI can say so instead of pretending the setting works.
 */

export type Haptic =
  | 'tap'       // keystroke / light selection
  | 'select'    // switching a mode, picking from a list
  | 'impact'    // committed action: send, start, record
  | 'success'   // a reply landed, something completed
  | 'warning'   // timer finished, limit reached
  | 'error';    // request failed

const PATTERNS: Record<Haptic, number | number[]> = {
  tap: 8,
  select: 14,
  impact: 22,
  success: [14, 45, 22],
  warning: [24, 70, 24],
  error: [30, 45, 30, 45, 30],
};

/** Outcome patterns are "alerts"; the short ones are "taps". */
const IS_ALERT: Record<Haptic, boolean> = {
  tap: false,
  select: false,
  impact: false,
  success: true,
  warning: true,
  error: true,
};

function isNativeShell(): boolean {
  return typeof window !== 'undefined'
    && !!(window as any).Capacitor?.isNativePlatform?.();
}

export function isHapticsSupported(): boolean {
  if (isNativeShell()) return true;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * The OS equivalent of each pattern.
 *
 * The native API deals in named feedback rather than millisecond timings, and
 * the names map cleanly onto the taxonomy above — so the shell gets the
 * platform's own tuned haptics rather than an approximation of them.
 */
async function fireNative(kind: Haptic): Promise<void> {
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  switch (kind) {
    case 'tap':     return Haptics.impact({ style: ImpactStyle.Light });
    case 'select':  return Haptics.selectionChanged();
    case 'impact':  return Haptics.impact({ style: ImpactStyle.Medium });
    case 'success': return Haptics.notification({ type: NotificationType.Success });
    case 'warning': return Haptics.notification({ type: NotificationType.Warning });
    case 'error':   return Haptics.notification({ type: NotificationType.Error });
  }
}

let lastFiredAt = 0;

export interface HapticOptions {
  /** Gates tap / select / impact. */
  taps: boolean;
  /** Gates success / warning / error. */
  alerts: boolean;
  /**
   * Minimum gap since the previous haptic. Typing passes a value here so a
   * fast typist gets a rhythm rather than a continuous rattle.
   */
  throttleMs?: number;
}

export function fireHaptic(kind: Haptic, { taps, alerts, throttleMs = 0 }: HapticOptions): void {
  if (!isHapticsSupported()) return;
  if (IS_ALERT[kind] ? !alerts : !taps) return;

  const now = Date.now();
  if (throttleMs > 0 && now - lastFiredAt < throttleMs) return;
  lastFiredAt = now;

  if (isNativeShell()) {
    // Deliberately not awaited: a haptic is feedback, and nothing should wait
    // on it. A shell built before the plugin existed simply rejects.
    fireNative(kind).catch(() => {});
    return;
  }

  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw if the page is not visible or the gesture is stale.
  }
}
