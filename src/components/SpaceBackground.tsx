import React, { useMemo } from 'react';
import { motion } from 'motion/react';

export const SpaceBackground: React.FC = () => {
  // Generate random stars
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      size: Math.random() * 2 + 0.5,
      left: `${Math.random() * 100}%`,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 20,
      opacity: Math.random() * 0.4 + 0.1,
      speed: Math.random() * 0.5 + 0.5, // Parallax effect
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-[#050505]">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          initial={{ y: '110vh', opacity: 0 }}
          animate={{ 
            y: '-10vh',
            opacity: [0, star.opacity, star.opacity, 0]
          }}
          transition={{
            duration: star.duration / star.speed,
            repeat: Infinity,
            delay: -star.delay, // Negative delay to start at random positions
            ease: "linear"
          }}
          className="absolute rounded-full bg-white/80 shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          style={{
            width: star.size,
            height: star.size,
            left: star.left,
          }}
        />
      ))}
      
      {/* Subtle nebula-like glows */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-aura-red/5 to-transparent pointer-events-none" />
      <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-aura-red/10 blur-[150px] rounded-full opacity-30" />
      <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-aura-red/10 blur-[150px] rounded-full opacity-30" />
    </div>
  );
};
