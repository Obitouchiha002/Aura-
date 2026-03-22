import { motion } from 'motion/react';
import { useLang } from '../context/LanguageContext';

const rulesData = {
  en: [
    "Talk less. Observe more.",
    "Control emotions or they control you.",
    "Stop seeking approval.",
    "Action cures fear.",
    "Your word is your bond.",
    "Expect nothing. Appreciate everything.",
    "Discipline equals freedom.",
    "Pain is information. Listen to it."
  ],
  hi: [
    "कम बोलो। ज़्यादा देखो।",
    "भावनाओं पर काबू रखो, वरना वो तुम पर काबू कर लेंगी।",
    "दूसरों की मंज़ूरी मांगना बंद करो।",
    "काम करने से डर खत्म होता है।",
    "तुम्हारी ज़ुबान ही तुम्हारी पहचान है।",
    "किसी से कोई उम्मीद मत रखो। हर चीज़ की कद्र करो।",
    "अनुशासन ही आज़ादी है।",
    "दर्द एक जानकारी है। इसे सुनो।"
  ]
};

export default function Rules() {
  const { lang } = useLang();
  const rules = lang === 'en' ? rulesData.en : rulesData.hi;

  return (
    <div className="min-h-screen bg-transparent pt-32 pb-24 px-6 md:px-12 lg:px-24 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.02)_0%,rgba(0,0,0,1)_80%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl w-full z-10"
      >
        <h1 className="font-display text-5xl md:text-7xl font-light tracking-tighter mb-16 text-center">
          {lang === 'en' ? 'The Rules' : 'नियम'}
        </h1>

        <div className="space-y-6 md:space-y-8">
          {rules.map((rule, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group flex items-center gap-6 md:gap-12 border-b border-white/5 pb-6 hover:border-red-500/30 transition-colors duration-500"
            >
              <span className="font-display text-red-500/50 text-xl md:text-3xl font-light w-12 text-right group-hover:text-red-500 transition-colors duration-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-xl md:text-3xl font-light tracking-tight text-white/80 group-hover:text-white transition-colors duration-500">
                {rule}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
