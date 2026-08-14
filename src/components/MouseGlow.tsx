import React, { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';
import { useSettings } from '../context/SettingsContext';

/**
 * Ambient backdrop for the quote screen.
 *
 * With a real cursor it is a light source that follows you: a wide, slow halo
 * with a small, quicker core, so the two separate as you move and read as one
 * light with a trail rather than three stacked blobs.
 *
 * With no cursor — phones, tablets — there is nothing to follow, so it becomes
 * a slow night sky with the occasional meteor.
 */

function useHasCursor() {
  const [hasCursor, setHasCursor] = useState(false);
  useEffect(() => {
    // pointer:fine is the right question — 'ontouchstart' is also true on
    // touchscreen laptops, which do have a cursor.
    const mq = window.matchMedia('(pointer: fine)');
    const apply = () => setHasCursor(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return hasCursor;
}

function NightSky({ dim }: { dim: boolean }) {
  const stars = useMemo(
    () => Array.from({ length: 46 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 1.6 + 0.9,
      min: Math.random() * 0.15 + 0.06,
      max: Math.random() * 0.4 + 0.35,
      dur: Math.random() * 5 + 4,
      delay: Math.random() * 6,
    })),
    []
  );

  // Few, slow, and widely staggered — a meteor should feel like a moment, not
  // a weather effect.
  const meteors = useMemo(
    () => Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      left: Math.random() * 70 + 15,
      top: Math.random() * 30,
      len: Math.random() * 70 + 80,
      // Long cycle, short visible window — see the meteor-fall keyframes.
      dur: Math.random() * 8 + 20,
      delay: i * 6 + Math.random() * 6,
    })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: dim ? 0.45 : 1 }}>
      {stars.map(s => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: 'var(--star)',
            ['--s-min' as any]: s.min,
            ['--s-max' as any]: s.max,
            animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {meteors.map(m => (
        <span
          key={m.id}
          className="absolute h-px origin-left"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.len,
            rotate: '38deg',
            background: 'linear-gradient(90deg, transparent, var(--star))',
            ['--m-dx' as any]: '-60vw',
            ['--m-dy' as any]: '60vh',
            animation: `meteor-fall ${m.dur}s linear ${m.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export const MouseGlow: React.FC = () => {
  const { theme } = useSettings();
  const hasCursor = useHasCursor();
  const isLight = theme === 'light';

  const mouseX = useMotionValue(-400);
  const mouseY = useMotionValue(-400);

  // Two speeds: the halo lags, the core keeps up. That gap is the whole effect.
  const haloX = useSpring(mouseX, { damping: 40, stiffness: 90, mass: 1.1 });
  const haloY = useSpring(mouseY, { damping: 40, stiffness: 90, mass: 1.1 });
  const coreX = useSpring(mouseX, { damping: 30, stiffness: 500 });
  const coreY = useSpring(mouseY, { damping: 30, stiffness: 500 });

  useEffect(() => {
    if (!hasCursor) return;
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [hasCursor, mouseX, mouseY]);

  if (!hasCursor) {
    return (
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        <NightSky dim={isLight} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      // `screen` makes it behave like light falling on the page instead of
      // paint sitting on top of it. Light theme has no equivalent, so it just
      // gets a much fainter plain wash.
      style={{ mixBlendMode: isLight ? 'normal' : 'screen', opacity: isLight ? 0.5 : 1 }}
    >
      <motion.div
        className="absolute w-[560px] h-[560px] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          left: haloX,
          top: haloY,
          background: isLight
            ? 'radial-gradient(circle, var(--accent-wash) 0%, transparent 62%)'
            : 'radial-gradient(circle, rgba(229,72,77,.16) 0%, rgba(229,72,77,.05) 38%, transparent 66%)',
        }}
      />
      <motion.div
        className="absolute w-[150px] h-[150px] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          left: coreX,
          top: coreY,
          background: isLight
            ? 'radial-gradient(circle, var(--accent-wash) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(255,236,232,.14) 0%, transparent 68%)',
        }}
      />
    </div>
  );
};
