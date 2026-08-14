import React, { useMemo, useSyncExternalStore } from 'react';

/**
 * The drifting starfield behind the chat.
 *
 * Deliberately plain DOM with CSS keyframes rather than animated components:
 * this sits behind every chat screen and never stops, so it has to cost almost
 * nothing. CSS transforms and opacity are driven by the compositor, so the
 * field keeps moving smoothly even while the main thread is busy rendering a
 * long reply — and it costs no JavaScript per frame.
 *
 * Star count drops on small screens, and the field is dropped entirely for
 * anyone who has asked their system to reduce motion.
 */

/** Reads a media query and re-renders only when it actually flips. */
function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(
    () => (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const SpaceBackground: React.FC = () => {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isNarrow = useMediaQuery('(max-width: 640px)');

  const count = isNarrow ? 34 : 70;

  const stars = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const speed = Math.random() * 0.5 + 0.5; // parallax
        return {
          id: i,
          size: Math.random() * 2 + 0.5,
          left: `${Math.random() * 100}%`,
          duration: (Math.random() * 15 + 10) / speed,
          // A negative delay drops each star in mid-flight, so the field looks
          // settled on the first frame instead of rising all at once.
          delay: -Math.random() * 20,
          opacity: Math.random() * 0.4 + 0.1,
        };
      }),
    [count],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-bg">
      {!reduceMotion &&
        stars.map(star => (
          <span
            key={star.id}
            className="star-drift absolute rounded-full"
            style={{
              width: star.size,
              height: star.size,
              left: star.left,
              // --star flips to a dark speck in the light theme, where white
              // specks on a white page are simply invisible.
              backgroundColor: 'var(--star)',
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              ['--star-opacity' as string]: star.opacity,
            }}
          />
        ))}

      {/* Subtle nebula-like glows.
          Gated on --glow-strength, which the light theme sets to 0: a red
          bloom reads as atmosphere against black and as a stain on white. */}
      <div className="absolute inset-0 overflow-hidden" style={{ opacity: 'var(--glow-strength)' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-aura-red/5 to-transparent" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-aura-red/10 blur-[110px] rounded-full opacity-30" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-aura-red/10 blur-[110px] rounded-full opacity-30" />
      </div>
    </div>
  );
};
