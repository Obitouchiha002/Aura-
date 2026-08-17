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

/**
 * Portraits that ship with the app.
 *
 * These eight exist under a free licence, so they are bundled rather than
 * uploaded — the roster on the site uses the same files. Anything uploaded
 * through the admin page wins over these, which is what makes a bundled
 * portrait replaceable without a release.
 *
 * Keyed by slug rather than derived from the filename: "Mirza Ghalib" slugs to
 * mirzaghalib, and the file is simply called ghalib.jpg.
 */
const BUILT_IN: Record<string, string> = {
  mirzaghalib: '/people/ghalib.jpg',
  faizahmedfaiz: '/people/faiz.jpg',
  jaunelia: '/people/jaunelia.jpg',
  ahmadfaraz: '/people/ahmadfaraz.jpg',
  williamshakespeare: '/people/shakespeare.jpg',
  niccolmachiavelli: '/people/machiavelli.jpg',
  suntzu: '/people/suntzu.jpg',
  chanakya: '/people/chanakya.jpg',
};

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
    // Start from what ships with the app, then let uploads override.
    const found = new Map<string, string>(Object.entries(BUILT_IN));
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
