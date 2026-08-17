import React, { useEffect, useState } from 'react';
import { loadPortraits, slugFor } from '../utils/portraits';

/**
 * A character's face where one has been uploaded, their initials where it has
 * not.
 *
 * The portrait is only swapped in once it has decoded, so the initials never
 * flash and then jump — the avatar simply resolves into a face. Sizing and
 * colour stay with the caller, since this appears at three different sizes on
 * three different grounds.
 */
interface Props {
  /** The full character string, e.g. "L (Death Note)". */
  name: string;
  /** Initials to show until — or unless — a portrait arrives. */
  fallback: string;
  className?: string;
}

export const CharacterAvatar: React.FC<Props> = ({ name, fallback, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSrc(null);

    loadPortraits().then(map => {
      const found = map.get(slugFor(name));
      if (!live || !found) return;

      // Decode first, then swap. Otherwise the image paints in halfway and the
      // initials underneath show through the gap.
      const probe = new Image();
      probe.onload = () => { if (live) setSrc(found); };
      probe.src = found;
    });

    return () => { live = false; };
  }, [name]);

  if (!src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`absolute inset-0 w-full h-full object-cover rounded-full ${className}`}
    />
  );
};
