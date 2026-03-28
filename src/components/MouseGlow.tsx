import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';

export const MouseGlow: React.FC = () => {
  const [isTouch, setIsTouch] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth out the movement
  const springX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const springY = useSpring(mouseY, { damping: 50, stiffness: 400 });

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    if (!isTouch) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isTouch, mouseX, mouseY]);

  if (isTouch) {
    // For touch devices, we can add a subtle pulsing background glow instead
    return (
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] rounded-full bg-aura-red/20 blur-[150px]"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* Outer Glow */}
      <motion.div
        className="absolute w-[900px] h-[900px] rounded-full bg-aura-red/20 blur-[180px] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: springX,
          top: springY,
        }}
      />
      {/* Inner Core */}
      <motion.div
        className="absolute w-[200px] h-[200px] rounded-full bg-aura-red/40 blur-[80px] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: springX,
          top: springY,
        }}
      />
      {/* Brightest Center */}
      <motion.div
        className="absolute w-[40px] h-[40px] rounded-full bg-white/30 blur-[20px] -translate-x-1/2 -translate-y-1/2"
        style={{
          left: springX,
          top: springY,
        }}
      />
    </div>
  );
};
