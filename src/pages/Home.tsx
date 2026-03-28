import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Typewriter } from '../components/Typewriter';

interface HomeProps {
  onEnter: () => void;
}

const QUOTES = [
  { character: "Thomas Shelby", quote: "I don't pay for suits. My suits are on the house or the house burns down.", theme: "power" },
  { character: "Thomas Shelby", quote: "You can change what you do, but you can't change what you want.", theme: "ambition" },
  { character: "Tywin Lannister", quote: "A lion doesn't concern himself with the opinions of the sheep.", theme: "power" },
  { character: "Tywin Lannister", quote: "Any man who must say, 'I am the king', is no true king.", theme: "strategy" },
  { character: "Madara Uchiha", quote: "Wake up to reality! Nothing ever goes as planned in this accursed world.", theme: "shadow" },
  { character: "Madara Uchiha", quote: "In this world, wherever there is light - there are also shadows.", theme: "shadow" },
  { character: "Itachi Uchiha", quote: "People's lives don't end when they die, it ends when they lose faith.", theme: "shadow" },
  { character: "Itachi Uchiha", quote: "It is foolish to fear what we yet to see and know.", theme: "strategy" },
  { character: "Pain", quote: "Sometimes you must hurt in order to know, fall in order to grow, lose in order to gain.", theme: "pain" },
  { character: "Pain", quote: "Those who do not understand true pain can never understand true peace.", theme: "pain" },
  { character: "Johan Liebert", quote: "The only thing all humans are equal in is death.", theme: "shadow" },
  { character: "Johan Liebert", quote: "There is nothing special about being born. Not a thing.", theme: "shadow" },
  { character: "Kiyotaka Ayanokoji", quote: "I've never once thought of you as an ally. Not you. Not Kushida. Not Hirata. All people are nothing but tools.", theme: "strategy" },
  { character: "Kiyotaka Ayanokoji", quote: "It doesn't matter how it's done. It doesn't matter what needs to be sacrificed. In this world, winning is everything.", theme: "ambition" },
  { character: "Harvey Specter", quote: "I don't have dreams, I have goals.", theme: "ambition" },
  { character: "Harvey Specter", quote: "When you're backed against the wall, break the goddamn thing down.", theme: "strategy" },
  { character: "Walter White", quote: "I am not in danger, Skyler. I am the danger.", theme: "power" },
  { character: "Walter White", quote: "Tread lightly.", theme: "power" },
  { character: "Gustavo Fring", quote: "I hide in plain sight, same as you.", theme: "strategy" },
  { character: "Gustavo Fring", quote: "Never make the same mistake twice.", theme: "strategy" }
];

export const Home: React.FC<HomeProps> = ({ onEnter }) => {
  const [quote, setQuote] = useState<{ character: string; quote: string; theme: string } | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    // Pick a random quote on mount
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setQuote(randomQuote);

    // Push a state so we can intercept the back button
    window.history.pushState({ page: 'home' }, '', '');

    let lastBack = 0;
    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();
      if (now - lastBack < 2000) {
        // Double tap within 2 seconds, let it exit
        window.history.back();
      } else {
        // Prevent exit, show toast, and push state again
        lastBack = now;
        window.history.pushState({ page: 'home' }, '', '');
        setShowExitToast(true);
        setTimeout(() => setShowExitToast(false), 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-black text-white relative">
      {quote && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6 max-w-md">
          <Typewriter 
            text={`"${quote.quote}"`} 
            speed={50} 
            className="text-xl italic font-serif leading-relaxed" 
          />
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: (quote.quote.length * 0.05) + 0.5 }}
            className="text-sm text-aura-red uppercase tracking-widest"
          >
            {quote.character}
          </motion.p>
          <motion.button 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (quote.quote.length * 0.05) + 1 }}
            onClick={onEnter}
            className="px-8 py-3 bg-aura-red text-black font-bold rounded-full hover:scale-105 transition-transform"
          >
            ENTER
          </motion.button>
        </motion.div>
      )}

      {showExitToast && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-10 bg-white/10 text-white px-4 py-2 rounded-full text-xs backdrop-blur-md"
        >
          Press back again to exit
        </motion.div>
      )}
    </div>
  );
};
