import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Void() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-transparent relative overflow-hidden cursor-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,rgba(0,0,0,1)_50%)] pointer-events-none animate-pulse" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="z-10 text-center"
      >
        <h1 className="font-display text-2xl md:text-4xl font-light tracking-[0.5em] text-red-500/50 mb-12 uppercase">
          You were not supposed to find this.
        </h1>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          onClick={() => navigate('/')}
          className="text-white/20 hover:text-red-500 font-display uppercase tracking-[0.3em] text-xs transition-colors duration-1000"
        >
          Return
        </motion.button>
      </motion.div>
    </div>
  );
}
