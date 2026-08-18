/**
 * Updating the app itself, from inside the app.
 *
 * The over-the-air updater replaces the web layer, which is most of this app —
 * but it cannot replace the APK, and anything native (a permission, a plugin,
 * the launch image) needs one. Until now that meant opening the site in a
 * browser and downloading the file by hand, every time.
 *
 * This does the same thing without leaving the app: read what the newest build
 * is, fetch it into the app's own cache with a progress bar, and hand it to
 * Android's package installer.
 *
 * The install confirmation at the end is Android's and cannot be skipped. No
 * app may install another app silently — that is the platform's rule, not a
 * gap here. So it is one tap, then the system's own prompt.
 */

const APK_MANIFEST = 'https://aurashakti.vercel.app/updates/apk.json';

export interface ApkRelease {
  version: string;
  url: string;
  size: number;
  sha256: string;
  notes?: string;
}

function isNativeShell(): boolean {
  return typeof window !== 'undefined'
    && !!(window as any).Capacitor?.isNativePlatform?.();
}

/** "1.0.10" is newer than "1.0.9" — string compare would say otherwise. */
export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** The version of the APK installed right now, per the native layer. */
export async function installedVersion(): Promise<string | null> {
  if (!isNativeShell()) return null;
  try {
    const { App } = await import('@capacitor/app');
    return (await App.getInfo()).version || null;
  } catch {
    return null;
  }
}

/** The newest published build, or null when there is nothing newer. */
export async function checkForAppUpdate(): Promise<ApkRelease | null> {
  if (!isNativeShell()) return null;
  const current = await installedVersion();
  if (!current) return null;
  try {
    const release: ApkRelease = await fetch(APK_MANIFEST, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    return release?.version && isNewer(release.version, current) ? release : null;
  } catch {
    return null;
  }
}

/**
 * Fetches the build and opens Android's installer on it.
 *
 * The file goes to the app's own cache directory, which the file-opener's
 * FileProvider already exposes — an APK handed over from anywhere else is
 * refused by the installer as an unreadable URI.
 */
/**
 * Whether Android will let this app hand over an APK at all.
 *
 * Since Oreo the permission is granted per source by the user, so the first
 * update otherwise ends in "your phone isn't allowed to install unknown apps
 * from this source" — after the download, with no explanation. Asking first
 * turns that into one clear step.
 */
export async function canInstallApks(): Promise<boolean> {
  if (!isNativeShell()) return false;
  try {
    const p = (window as any).Capacitor?.Plugins?.InstallPermission;
    if (!p) return true; // older shell without the check — let it try
    return !!(await p.canInstall()).allowed;
  } catch {
    return true;
  }
}

/** Opens the one settings page where that permission lives. */
export async function openInstallPermissionSettings(): Promise<void> {
  try {
    await (window as any).Capacitor?.Plugins?.InstallPermission?.openSettings();
  } catch {}
}

export async function downloadAndInstall(
  release: ApkRelease,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { FileOpener } = await import('@capacitor-community/file-opener');

  const path = `AuraShakti-${release.version}.apk`;
  let handle: { remove: () => void } | null = null;

  if (onProgress) {
    handle = await Filesystem.addListener('progress', (e: any) => {
      const total = e?.contentLength || release.size || 0;
      if (total > 0) onProgress(Math.min(100, Math.round((e.bytes / total) * 100)));
    });
  }

  try {
    const result = await Filesystem.downloadFile({
      url: release.url,
      path,
      directory: Directory.Cache,
      progress: true,
    });

    const filePath = (result as any)?.path;
    if (!filePath) throw new Error('Download poora nahi hua');

    await FileOpener.open({
      filePath,
      contentType: 'application/vnd.android.package-archive',
    });
  } finally {
    handle?.remove();
  }
}
