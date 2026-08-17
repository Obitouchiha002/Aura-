import React, { useMemo, useSyncExternalStore } from 'react';
import { Starfield } from './Starfield';

/**
 * The drifting starfield behind the chat.
 *
 * Deliberately plain DOM with CSS keyframes rather than animated components:
 * this sits behind every chat screen and never stops, so it has to cost almost
 * nothing. CSS transforms and opacity are driven by the compositor, so the
 * field keeps moving smoothly even while the main thread is busy rendering a
 * long reply — and it costs no JavaScript per frame.
 *
 * The field is dropped entirely for anyone who has asked their system to
 * reduce motion.
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

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-bg">
      {!reduceMotion && <Starfield />}

      {/* Subtle nebula-like glows.
          Gated on --glow-strength, which the light theme sets to 0: a red
          bloom reads as atmosphere against black and as a stain on white.

          Painted as gradients rather than blurred shapes. A blur(110px) over
          a quarter of the screen is a convolution the Android WebView pays
          for in full, and a radial gradient is the same soft bloom for free. */}
      <div className="absolute inset-0 overflow-hidden" style={{ opacity: 'var(--glow-strength)' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-aura-red/5 to-transparent" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 42% at 8% 6%, rgba(229,72,77,.10) 0%, transparent 70%),' +
              'radial-gradient(60% 42% at 92% 94%, rgba(229,72,77,.10) 0%, transparent 70%)',
          }}
        />
      </div>
    </div>
  );
};
