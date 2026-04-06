import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.1)_0%,transparent_70%)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md w-full flex flex-col items-center space-y-8"
      >
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-serif italic text-aura-red">Welcome</h1>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Identify yourself to enter</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={login}
          className="flex items-center space-x-3 bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-4 rounded-full transition-colors backdrop-blur-sm"
        >
          <LogIn className="w-5 h-5 text-aura-red" />
          <span className="font-medium tracking-wide">Sign in with Google</span>
        </motion.button>
      </motion.div>

      <div className="absolute bottom-4 right-4 z-20">
        <a 
          href="mailto:vk1234888i@gmail.com?subject=Aura%20App%20Issue" 
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
        >
          Developer: Vansh Kashyap | Report Issue
        </a>
      </div>
    </div>
  );
};
