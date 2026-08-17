import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Character portraits, uploaded through the site's admin page.
 *
 * Same collection the public site reads, so a face added there shows up here
 * without another upload. Fetched once per session and held in memory: the
 * documents carry a resized JPEG each, and re-reading them on every render
 * would be both slow and pointlessly expensive.
 *
 * Everything here fails quietly. A portrait is decoration — if the read is
 * blocked, offline, or the collection does not exist, the app carries on
 * showing initials.
 */

const COLLECTION = 'site_portraits';

let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

/** Matches the slug the admin page writes documents under. */
export function slugFor(name: string): string {
  return name
    // "L (Death Note)" and "Chanakya (चाणक्य)" are stored under the bare name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function loadPortraits(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const found = new Map<string, string>();
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      snap.forEach(d => {
        const image = (d.data() as { image?: string }).image;
        if (typeof image === 'string' && image.startsWith('data:image/')) {
          found.set(d.id, image);
        }
      });
    } catch {
      // no portraits available; initials stand in
    }
    cache = found;
    inflight = null;
    return found;
  })();

  return inflight;
}

/** Drops the cache so a newly uploaded portrait appears without a reload. */
export function forgetPortraits() {
  cache = null;
  inflight = null;
}
