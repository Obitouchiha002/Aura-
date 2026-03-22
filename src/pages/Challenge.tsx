import { useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '../context/LanguageContext';

const challengesData = {
  en: [
    "Talk to one stranger without fear.",
    "Take a cold shower for 3 minutes.",
    "Do not complain about anything for 24 hours.",
    "Wake up at 5 AM and exercise immediately.",
    "Read 20 pages of a non-fiction book.",
    "Fast for 16 hours.",
    "Write down 3 things you are grateful for.",
    "Do 100 pushups throughout the day.",
    "Meditate in complete silence for 15 minutes.",
    "Delete all social media apps from your phone for 24 hours."
  ],
  hi: [
    "बिना डरे किसी एक अजनबी से बात करो।",
    "3 मिनट तक ठंडे पानी से नहाओ।",
    "24 घंटे तक किसी भी चीज़ की शिकायत मत करो।",
    "सुबह 5 बजे उठो और तुरंत कसरत करो।",
    "किसी नॉन-फिक्शन किताब के 20 पन्ने पढ़ो।",
    "16 घंटे का उपवास रखो।",
    "3 ऐसी चीज़ें लिखो जिनके लिए तुम आभारी हो।",
    "पूरे दिन में 100 पुशअप्स करो।",
    "15 मिनट तक पूरी शांति में ध्यान लगाओ।",
    "24 घंटे के लिए अपने फोन से सारे सोशल मीडिया ऐप्स डिलीट कर दो।"
  ]
};

export default function Challenge() {
  const { lang } = useLang();
  const [completed, setCompleted] = useState(false);

  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const challenges = lang === 'en' ? challengesData.en : challengesData.hi;
  const currentChallenge = challenges[dayIndex % challenges.length];

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,rgba(0,0,0,1)_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl w-full text-center z-10"
      >
        <h2 className="font-display text-red-500 text-sm tracking-[0.4em] uppercase mb-12">
          {lang === 'en' ? 'Daily Challenge' : 'दैनिक चुनौती'}
        </h2>

        <div className="relative border border-white/10 p-12 md:p-24 bg-white/[0.01] backdrop-blur-md overflow-hidden">
          {/* Subtle corner accents */}
          <div className="absolute top-0 left-0 w-4 h-[1px] bg-red-500/50" />
          <div className="absolute top-0 left-0 w-[1px] h-4 bg-red-500/50" />
          <div className="absolute bottom-0 right-0 w-4 h-[1px] bg-red-500/50" />
          <div className="absolute bottom-0 right-0 w-[1px] h-4 bg-red-500/50" />

          <motion.h1
            key={completed ? 'done' : 'todo'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className={`font-display text-3xl md:text-5xl lg:text-6xl font-light tracking-tighter leading-tight mb-16 ${completed ? 'text-white/40 line-through' : 'text-white'}`}
          >
            "{currentChallenge}"
          </motion.h1>

          {!completed ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCompleted(true)}
              className="group relative px-12 py-4 bg-transparent text-white font-display uppercase tracking-[0.2em] text-sm overflow-hidden border border-white/20 hover:border-red-500 transition-colors duration-300"
            >
              <span className="relative z-10 group-hover:text-black transition-colors duration-300">
                {lang === 'en' ? 'Complete' : 'पूरा करें'}
              </span>
              <div className="absolute inset-0 bg-red-500 transform scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" />
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-red-500 font-display uppercase tracking-[0.3em] text-sm"
            >
              {lang === 'en' ? 'Challenge Conquered. Return Tomorrow.' : 'चुनौती पूरी हुई। कल वापस आएं।'}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
