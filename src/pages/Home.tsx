import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Typewriter } from '../components/Typewriter';
import { ReportIssueModal } from '../components/ReportIssueModal';

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
  const [showReportModal, setShowReportModal] = useState(false);

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

  // Reveal the attribution and the ENTER button as the quote finishes typing
  const typingDuration = quote ? (quote.quote.length + 2) * 0.05 : 0;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 bg-bg text-text-primary relative overflow-hidden">
      {/* Atmosphere: a lit centre, a film grain so the field has a surface,
          and a vignette to pull the eye inward. All three retune per theme. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.2, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130vmax] h-[130vmax] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--halo) 0%, transparent 58%)' }}
        />
        <div className="absolute inset-0 grain" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 30%, var(--vignette) 100%)' }}
        />
      </div>

      {/* Wordmark anchors the screen as a product, not just a quote card */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-[max(1.75rem,env(safe-area-inset-top))] left-0 right-0 flex justify-center z-10"
      >
        <span className="flex items-baseline gap-[3px] select-none">
          <span className="font-display font-bold text-[15px] tracking-[0.28em] uppercase text-text-muted">
            Aura
          </span>
          <span className="w-[4px] h-[4px] rounded-full bg-aura-red translate-y-[-1px]" />
        </span>
      </motion.div>

      {quote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 text-center max-w-2xl w-full"
        >
          {/* A thin rule instead of a quote glyph — the swashy italic mark was
              softening a screen that should read as weight, not romance. */}
          <motion.span
            aria-hidden
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="block w-12 h-[2px] mx-auto mb-8 bg-aura-red origin-center"
          />

          {/* Upright, heavy, tight. Italic Playfair reads editorial-soft; the
              same face set upright at 600 reads authoritative. */}
          <Typewriter
            text={quote.quote}
            speed={50}
            className="font-serif font-semibold text-[30px] sm:text-[40px] md:text-[50px] leading-[1.14] tracking-[-0.025em] text-text-primary text-balance"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: typingDuration + 0.2, duration: 0.6 }}
            className="flex items-center justify-center mt-10"
          >
            <p className="text-[12px] sm:text-[13px] text-text-muted uppercase tracking-[0.2em] font-display font-medium whitespace-nowrap">
              {quote.character}
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: typingDuration + 0.45, duration: 0.6, ease: 'easeOut' }}
            onClick={onEnter}
            className="group mt-11 inline-flex items-center justify-center gap-2.5 h-[52px] px-9 rounded-full text-on-accent font-semibold text-[15px] tracking-[0.06em] bg-gradient-to-b from-accent to-accent-dim shadow-float hover:-translate-y-0.5 active:translate-y-0 transition-transform"
          >
            Enter
            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface-2 border border-border text-text-primary px-4 py-2 rounded-full text-xs backdrop-blur-md shadow-lg z-30"
          >
            Press back again to exit
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 px-4">
        <button
          onClick={() => setShowReportModal(true)}
          className="text-[10px] text-text-faint hover:text-text-muted transition-colors"
        >
          Developer: Vansh Kashyap | Report Issue
        </button>
      </div>

      <ReportIssueModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
      />
    </div>
  );
};
