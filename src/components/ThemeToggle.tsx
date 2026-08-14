import React, { useId } from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../context/SettingsContext';

/**
 * Sun ↔ moon toggle.
 *
 * One circle does both jobs: the rays retract and a second circle slides in to
 * bite a crescent out of it, so the sun becomes the moon rather than being
 * swapped for it. The mask means the crescent is a real hole, which keeps the
 * edge crisp against any background.
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, setTheme, haptic } = useSettings();
  const isDark = theme === 'dark';
  const maskId = useId();

  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  const spring = { type: 'spring' as const, stiffness: 220, damping: 20 };

  return (
    <button
      onClick={() => { haptic('select'); setTheme(isDark ? 'light' : 'dark'); }}
      role="switch"
      aria-checked={!isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={`w-11 h-11 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors ${className}`}
    >
      <motion.svg
        width="20" height="20" viewBox="0 0 24 24"
        animate={{ rotate: isDark ? -75 : 0 }}
        transition={spring}
      >
        <defs>
          <mask id={maskId}>
            {/* white keeps, black cuts away */}
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <motion.circle
              r="8"
              fill="black"
              animate={{ cx: isDark ? 16 : 26, cy: isDark ? 7 : 0 }}
              transition={spring}
            />
          </mask>
        </defs>

        <motion.circle
          cx="12" cy="12"
          fill="currentColor"
          mask={`url(#${maskId})`}
          animate={{ r: isDark ? 9 : 5.5 }}
          transition={spring}
        />

        <motion.g
          animate={{ opacity: isDark ? 0 : 1, scale: isDark ? 0.4 : 1 }}
          transition={{ ...spring, opacity: { duration: 0.18 } }}
          style={{ transformOrigin: '12px 12px' }}
        >
          {rays.map(deg => (
            <line
              key={deg}
              x1="12" y1="1.6" x2="12" y2="4.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </motion.g>
      </motion.svg>
    </button>
  );
};
