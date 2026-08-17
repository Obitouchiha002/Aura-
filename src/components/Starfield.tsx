import React, { useMemo } from 'react';

/**
 * The drifting night sky behind the app, painted rather than assembled.
 *
 * It used to be one absolutely-positioned span per star, each carrying
 * will-change: 34 behind the chat, 46 behind the home screen. Every one of
 * those is a compositor layer the GPU has to hold and re-composite on each
 * frame, forever, on every screen. A desktop swallows that without noticing.
 * A budget Android WebView spends its entire frame budget on it, which is why
 * the app stuttered everywhere in the APK while the browser looked fine.
 *
 * Here each depth is a single element whose background is a repeating tile of
 * radial gradients, moved by one transform. Three layers instead of eighty,
 * and the parallax survives because the layers drift at different speeds.
 *
 * The drift distance is exactly one tile. The background repeats at that
 * interval, so the end of the animation is pixel-identical to its start and
 * the loop has no seam.
 */

interface Layer {
  /** Size of the repeating tile, in px. Also the distance travelled per loop. */
  tile: number;
  /** Stars per tile. Screen-visible count is this times the tiles on screen. */
  count: number;
  /** Star radius in px. Nearer layers are larger. */
  radius: number;
  opacity: number;
  /** Seconds for one tile of travel. Nearer layers move faster. */
  duration: number;
}

/**
 * Tiles are large and reasonably populated on purpose. A small tile repeats
 * often enough on a phone screen that the eye picks out the same little
 * constellation stacked down the page, which reads as wallpaper rather than
 * as sky.
 */
const LAYERS: Layer[] = [
  { tile: 480, count: 9, radius: 0.7, opacity: 0.30, duration: 62 },
  { tile: 560, count: 7, radius: 1.0, opacity: 0.48, duration: 43 },
  { tile: 640, count: 5, radius: 1.4, opacity: 0.68, duration: 29 },
];

/** One layer's tile, as the three background properties that describe it. */
function tileStyle(layer: Layer): React.CSSProperties {
  const images: string[] = [];
  const positions: string[] = [];

  for (let i = 0; i < layer.count; i++) {
    const x = Math.round(Math.random() * layer.tile);
    const y = Math.round(Math.random() * layer.tile);
    const r = layer.radius;
    // The half-pixel of transparent past the edge is what keeps the dot from
    // looking like a jagged square at this size.
    images.push(`radial-gradient(circle, var(--star) 0 ${r}px, transparent ${r + 0.6}px)`);
    positions.push(`${x}px ${y}px`);
  }

  return {
    backgroundImage: images.join(', '),
    backgroundPosition: positions.join(', '),
    backgroundSize: `${layer.tile}px ${layer.tile}px`,
    backgroundRepeat: 'repeat',
  };
}

interface StarfieldProps {
  /** Fades the whole sky — the light theme wants it much quieter. */
  dim?: boolean;
  className?: string;
}

export const Starfield: React.FC<StarfieldProps> = ({ dim = false, className = '' }) => {
  // Positions are rolled once. Re-rolling them on a re-render would make the
  // sky jump, and there is nothing to gain from a different arrangement.
  const layers = useMemo(() => LAYERS.map(l => ({ layer: l, style: tileStyle(l) })), []);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ opacity: dim ? 0.45 : 1 }}>
      {layers.map(({ layer, style }, i) => (
        <div
          key={i}
          className="star-layer absolute left-0 right-0 top-0"
          style={{
            ...style,
            // A tile taller than the parent, so translating up by one tile
            // never exposes an empty strip at the bottom.
            height: `calc(100% + ${layer.tile}px)`,
            ['--layer-travel' as string]: `${layer.tile}px`,
            ['--layer-opacity' as string]: layer.opacity,
            animationDuration: `${layer.duration}s, ${11 + i * 4}s`,
          }}
        />
      ))}
    </div>
  );
};
