import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

export default function Landing() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [text, setText] = useState('');
  
  const fullTextEn = "You are not weak... you are simply an untrained warrior.";
  const fullTextHi = "तुम कमज़ोर नहीं हो... बस तुम्हारी ट्रेनिंग नहीं हुई है।";
  const fullText = lang === 'en' ? fullTextEn : fullTextHi;

  useEffect(() => {
    setText('');
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, [fullText]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-transparent relative overflow-hidden">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05)_0%,rgba(0,0,0,1)_70%)] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="z-10 text-center px-4"
      >
        <h1 className="font-display text-3xl md:text-5xl lg:text-7xl font-light tracking-tight text-white mb-12 min-h-[6rem] md:min-h-[8rem] flex items-center justify-center">
          <span>
            {text}
            <span className="typewriter-cursor"></span>
          </span>
        </h1>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: text.length === fullText.length ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          onClick={() => navigate('/awakening')}
          className="group relative px-8 py-4 bg-transparent text-red-500 font-display uppercase tracking-[0.3em] text-sm overflow-hidden"
        >
          <span className="relative z-10 group-hover:text-black transition-colors duration-500">
            {lang === 'en' ? 'Enter' : 'प्रवेश करें'}
          </span>
          <div className="absolute inset-0 bg-red-500 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" />
          <div className="absolute inset-0 border border-red-500/30 group-hover:border-transparent transition-colors duration-500" />
          <div className="absolute inset-0 shadow-[0_0_20px_rgba(239,68,68,0.3)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </motion.button>
      </motion.div>
    </div>
  );
}
