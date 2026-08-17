import React, { useState } from 'react';

/**
 * A person's profile picture, with their initial when there isn't one.
 *
 * Two things break these otherwise. Google serves avatars from
 * lh3.googleusercontent.com and refuses requests carrying a referrer it does
 * not recognise, so the image has to be asked for without one. And when a URL
 * does fail — a deleted account, an expired link — an <img> leaves a broken
 * icon behind, so the failure is caught and the initial takes over.
 */
interface Props {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** Tailwind sizing and shape, e.g. "w-8 h-8". */
  className?: string;
}

export const Avatar: React.FC<Props> = ({ src, name, email, className = 'w-8 h-8' }) => {
  const [failed, setFailed] = useState(false);
  const letter = (name || email || '?').trim().charAt(0).toUpperCase() || '?';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} rounded-full object-cover shrink-0 bg-surface-2`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} rounded-full bg-surface-2 border border-border flex items-center justify-center font-bold uppercase text-text-muted shrink-0`}
    >
      {letter}
    </span>
  );
};
