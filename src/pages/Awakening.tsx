import { motion, useScroll, useTransform, MotionValue } from 'motion/react';
import React, { useRef, useMemo } from 'react';
import { useLang } from '../context/LanguageContext';

const truthsEn = [
  "No one is coming to save you.",
  "Comfort is your biggest enemy.",
  "You avoid pain, that's why you stay the same.",
];

const truthsHi = [
  "कोई तुम्हें बचाने नहीं आने वाला।",
  "आराम तुम्हारा सबसे बड़ा दुश्मन है।",
  "तुम दर्द से भागते हो, इसीलिए तुम्हारी जिंदगी बदल नहीं रही।",
];

const dailyQuestionsEn = [
  '"Wake up to reality! Nothing ever goes as planned in this accursed world." - Madara Uchiha',
  '"People’s lives don’t end when they die. It ends when they lose faith." - Itachi Uchiha',
  '"The only thing all humans are equal in is death." - Johan Liebert',
  '"I\'ve never once thought of you as an ally. All people are nothing but tools." - Kiyotaka Ayanokoji',
  '"Those who forgive themselves, and are able to accept their true nature... They are the strong ones!" - Itachi Uchiha',
  '"In this world, winning is everything. As long as I win in the end, that\'s all that matters." - Kiyotaka Ayanokoji',
  '"Man only realizes the value of what he has when he loses it." - Orochimaru'
];

const dailyQuestionsHi = [
  '"हकीकत का सामना करो! इस शापित दुनिया में कभी कुछ भी प्लान के हिसाब से नहीं होता।" - मादारा उचिहा',
  '"इंसान तब नहीं मरता जब उसकी सांसें रुकती हैं, वो तब मरता है जब उसका विश्वास टूट जाता है।" - इताची उचिहा',
  '"मौत ही एक ऐसी चीज़ है जिसमें सारे इंसान बराबर हैं।" - जोहान लिबर्ट',
  '"मैंने तुम्हें कभी अपना साथी नहीं माना। सब लोग सिर्फ इस्तेमाल करने की चीज़ें हैं।" - कियोताका अयानोकोजी',
  '"जो खुद को माफ़ कर सकते हैं, और अपनी असलियत को अपना सकते हैं... वही असली ताक़तवर हैं!" - इताची उचिहा',
  '"इस दुनिया में जीत ही सब कुछ है। जब तक मैं आखिर में जीतता हूँ, बस वही मायने रखता है।" - कियोताका अयानोकोजी',
  '"इंसान को किसी चीज़ की अहमियत तब पता चलती है जब वो उसे खो देता है।" - ओरोचिमारू'
];

function AwakeningText({ text, index, isDaily, scrollYProgress, lang }: { text: string, index: number, isDaily: boolean, scrollYProgress: MotionValue<number>, lang: string, key?: React.Key }) {
  const start = index * 0.25;
  const end = start + 0.25;
  
  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [0, 1, 1, 0]
  );
  
  const y = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [50, 0, 0, -50]
  );
  
  const scale = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [0.9, 1, 1, 1.1]
  );

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none px-4"
    >
      {isDaily && (
        <div className="text-red-500 text-xs tracking-[0.4em] uppercase mb-8 font-display">
          {lang === 'en' ? 'Anime Quote of the Day' : 'आज का एनीमे कोट'}
        </div>
      )}
      <h2 className={`font-display text-3xl md:text-5xl lg:text-7xl font-light text-center tracking-tighter leading-tight max-w-5xl ${isDaily ? 'text-red-50/90' : ''}`}>
        {text}
      </h2>
    </motion.div>
  );
}

export default function Awakening() {
  const { lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const truths = lang === 'en' ? truthsEn : truthsHi;
  const questions = lang === 'en' ? dailyQuestionsEn : dailyQuestionsHi;

  // Get a daily question based on the current date
  const dailyQuestion = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return questions[dayIndex % questions.length];
  }, [questions]);

  const allTexts = [...truths, dailyQuestion];

  return (
    <div ref={containerRef} className="bg-transparent text-white min-h-[500vh] relative">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.05),transparent_50%)]" />

      {allTexts.map((text, index) => (
        <AwakeningText
          key={index}
          text={text}
          index={index}
          isDaily={index === allTexts.length - 1}
          scrollYProgress={scrollYProgress}
          lang={lang}
        />
      ))}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-50 animate-pulse z-10">
        <span className="text-xs uppercase tracking-[0.3em] mb-2 font-display">
          {lang === 'en' ? 'Scroll' : 'स्क्रॉल करें'}
        </span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-red-500 to-transparent" />
      </div>
    </div>
  );
}
