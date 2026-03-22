import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { getDailyQuote } from '../services/geminiService';

export default function DailyQuote() {
  const { lang } = useLang();
  const [quoteData, setQuoteData] = useState<{character: string, quote: string, theme: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyQuote = async () => {
      const today = new Date().toLocaleDateString();
      const cachedDate = localStorage.getItem('aura_daily_quote_date');
      const cachedQuote = localStorage.getItem('aura_daily_quote_data');

      if (cachedDate === today && cachedQuote) {
        setQuoteData(JSON.parse(cachedQuote));
        setLoading(false);
        return;
      }

      try {
        const data = await getDailyQuote();
        if (data.character && data.quote && data.theme) {
          localStorage.setItem('aura_daily_quote_date', today);
          localStorage.setItem('aura_daily_quote_data', JSON.stringify(data));
          setQuoteData(data);
        }
      } catch (error) {
        console.error("Failed to fetch daily quote:", error);
        // Fallback
        setQuoteData({
          character: "Thomas Shelby",
          quote: "You can change what you do, but you can't change what you want.",
          theme: "ambition"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDailyQuote();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-aura-black text-aura-red font-mono tracking-widest">LOADING...</div>;
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden pt-20">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: `url(https://picsum.photos/seed/${quoteData?.theme || 'dark'}/1920/1080?grayscale)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-aura-black via-aura-black/80 to-transparent z-0" />

      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
      >
        <h2 className="text-aura-red font-display text-sm tracking-[0.5em] uppercase mb-8">
          {lang === 'en' ? 'Quote of the Day' : 'आज का विचार'}
        </h2>
        <blockquote className="text-3xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-8 text-white drop-shadow-2xl">
          "{quoteData?.quote}"
        </blockquote>
        <cite className="text-xl md:text-2xl text-white/70 font-serif italic block">
          — {quoteData?.character}
        </cite>
      </motion.div>
    </div>
  );
}
