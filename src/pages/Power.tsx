import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { AudioEngine } from '../utils/audio';

const localAudioEngine = new AudioEngine();

const powersData = {
  en: [
    {
      id: 'discipline',
      title: 'Discipline',
      hoverLine: 'Doing what you hate… like it’s nothing.',
      sequence: ['Discipline is choosing pain over comfort.', 'Comfort is killing your potential.'],
      challenge: 'Stay focused for 1 hour without touching your phone.',
      audio: 'heartbeat'
    },
    {
      id: 'focus',
      title: 'Focus',
      hoverLine: 'A weapon forged in isolation.',
      sequence: ['Focus is the ultimate weapon.', 'Distraction is the enemy of greatness.'],
      challenge: 'Read 20 pages of a book with zero interruptions.',
      audio: 'drone'
    },
    {
      id: 'silence',
      title: 'Silence',
      hoverLine: 'The loudest answer to disrespect.',
      sequence: ['Silence builds power.', 'Let them guess your next move.'],
      challenge: 'Remain completely silent for the next 2 hours.',
      audio: null
    },
    {
      id: 'confidence',
      title: 'Confidence',
      hoverLine: 'Believing you are the king before you wear the crown.',
      sequence: ['Confidence is quiet.', 'Insecurities are loud.'],
      challenge: 'Walk into a room and make eye contact with everyone.',
      audio: 'scifi'
    },
    {
      id: 'resilience',
      title: 'Resilience',
      hoverLine: 'Taking the hit and moving forward.',
      sequence: ['The world breaks everyone.', 'But some are strong at the broken places.'],
      challenge: 'Do 50 pushups or an intense workout when you feel like quitting.',
      audio: 'heartbeat'
    },
    {
      id: 'detachment',
      title: 'Detachment',
      hoverLine: 'Caring less about what doesn\'t matter.',
      sequence: ['Attachment is the root of suffering.', 'Let go of what you cannot control.'],
      challenge: 'Delete one social media app for 24 hours.',
      audio: 'drone'
    },
    {
      id: 'patience',
      title: 'Patience',
      hoverLine: 'The calm before the storm.',
      sequence: ['Patience is not waiting.', 'It is the ability to keep a good attitude while waiting.'],
      challenge: 'Sit in a room doing absolutely nothing for 15 minutes.',
      audio: 'scifi'
    }
  ],
  hi: [
    {
      id: 'discipline',
      title: 'अनुशासन',
      hoverLine: 'वो करना जो तुम्हें नापसंद है... जैसे वो कुछ भी नहीं।',
      sequence: ['अनुशासन का मतलब है आराम से पहले दर्द को चुनना।', 'आराम तुम्हारी काबिलियत को मार रहा है।'],
      challenge: 'बिना फोन छुए 1 घंटे तक पूरा फोकस बनाए रखो।',
      audio: 'heartbeat'
    },
    {
      id: 'focus',
      title: 'फोकस',
      hoverLine: 'अकेलेपन में बना एक हथियार।',
      sequence: ['फोकस सबसे बड़ा हथियार है।', 'भटकाव महानता का दुश्मन है।'],
      challenge: 'बिना किसी रुकावट के एक किताब के 20 पन्ने पढ़ो।',
      audio: 'drone'
    },
    {
      id: 'silence',
      title: 'खामोशी',
      hoverLine: 'बेइज्जती का सबसे ज़ोरदार जवाब।',
      sequence: ['खामोशी ताकत बनाती है।', 'उन्हें तुम्हारी अगली चाल का अंदाज़ा लगाने दो।'],
      challenge: 'अगले 2 घंटे तक पूरी तरह से शांत रहो।',
      audio: null
    },
    {
      id: 'confidence',
      title: 'आत्मविश्वास',
      hoverLine: 'ताज पहनने से पहले खुद को राजा मानना।',
      sequence: ['आत्मविश्वास शांत होता है।', 'असुरक्षा शोर मचाती है।'],
      challenge: 'किसी कमरे में जाओ और सबसे नज़रें मिलाओ।',
      audio: 'scifi'
    },
    {
      id: 'resilience',
      title: 'लचीलापन',
      hoverLine: 'चोट खाकर भी आगे बढ़ना।',
      sequence: ['दुनिया सबको तोड़ती है।', 'पर कुछ लोग टूटी हुई जगहों से और मजबूत हो जाते हैं।'],
      challenge: 'जब हार मानने का मन करे, तब 50 पुशअप्स या कोई भारी वर्कआउट करो।',
      audio: 'heartbeat'
    },
    {
      id: 'detachment',
      title: 'विरक्ति',
      hoverLine: 'जो मायने नहीं रखता, उसकी परवाह कम करना।',
      sequence: ['लगाव ही दुख का कारण है।', 'जो तुम्हारे बस में नहीं है, उसे जाने दो।'],
      challenge: '24 घंटे के लिए कोई एक सोशल मीडिया ऐप डिलीट कर दो।',
      audio: 'drone'
    },
    {
      id: 'patience',
      title: 'धैर्य',
      hoverLine: 'तूफान से पहले की शांति।',
      sequence: ['धैर्य का मतलब सिर्फ इंतज़ार करना नहीं है।', 'इंतज़ार करते हुए सही रवैया बनाए रखना है।'],
      challenge: '15 मिनट तक एक कमरे में बैठकर कुछ भी मत करो।',
      audio: 'scifi'
    }
  ]
};

const liveLinesData = {
  en: [
    "You don't lack time. You lack discipline.",
    "Focus is a weapon.",
    "Silence builds power.",
    "Pain is the price of freedom."
  ],
  hi: [
    "तुम्हारे पास समय की कमी नहीं है। तुम्हारे पास अनुशासन की कमी है।",
    "फोकस एक हथियार है।",
    "खामोशी ताकत बनाती है।",
    "दर्द आज़ादी की कीमत है।"
  ]
};

function LiveLines({ lang }: { lang: 'en' | 'hi' }) {
  const lines = liveLinesData[lang];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % lines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [lines]);

  return (
    <div className="h-20 flex items-center justify-center overflow-hidden my-12">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8 }}
          className="text-white/60 text-xl md:text-2xl font-light text-center tracking-widest uppercase"
        >
          {lines[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function SplitView({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <div className="flex flex-col md:flex-row w-full max-w-5xl mx-auto my-24 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex-1 p-12 bg-black/50 border-b md:border-b-0 md:border-r border-white/10 flex flex-col items-center justify-center group relative overflow-hidden">
        <div className="absolute inset-0 bg-red-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <h3 className="text-white/30 text-sm tracking-[0.3em] uppercase mb-8">
          {lang === 'en' ? 'Weak Version' : 'कमज़ोर रूप'}
        </h3>
        <ul className="space-y-4 text-center text-white/50 font-light">
          <li>{lang === 'en' ? 'Distracted' : 'भटका हुआ'}</li>
          <li>{lang === 'en' ? 'Lazy' : 'आलसी'}</li>
          <li>{lang === 'en' ? 'Emotional' : 'भावुक'}</li>
        </ul>
      </div>
      <div className="flex-1 p-12 bg-black/80 flex flex-col items-center justify-center group relative overflow-hidden">
        <div className="absolute inset-0 bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <h3 className="text-red-500 text-sm tracking-[0.3em] uppercase mb-8 font-bold">
          {lang === 'en' ? 'Power Version' : 'ताकतवर रूप'}
        </h3>
        <ul className="space-y-4 text-center text-white font-medium tracking-wide">
          <li>{lang === 'en' ? 'Focused' : 'फोकस्ड'}</li>
          <li>{lang === 'en' ? 'Relentless' : 'लगातार'}</li>
          <li>{lang === 'en' ? 'Calm' : 'शांत'}</li>
        </ul>
      </div>
    </div>
  );
}

function PowerMeter({ lang }: { lang: 'en' | 'hi' }) {
  const [progress, setProgress] = useState({ discipline: 0, focus: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress({ discipline: 20, focus: 40 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const completeTask = (type: 'discipline' | 'focus') => {
    setProgress(prev => ({
      ...prev,
      [type]: Math.min(prev[type] + 10, 100)
    }));
  };

  return (
    <div className="w-full max-w-md mx-auto my-24 space-y-8">
      <div>
        <div className="flex justify-between text-xs tracking-widest uppercase mb-2 text-white/60">
          <span>{lang === 'en' ? 'Discipline' : 'अनुशासन'}</span>
          <span>{progress.discipline}%</span>
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress.discipline}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <button onClick={() => completeTask('discipline')} className="mt-2 text-[10px] text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors cursor-none">
          + {lang === 'en' ? 'Complete Task' : 'टास्क पूरा करें'}
        </button>
      </div>
      <div>
        <div className="flex justify-between text-xs tracking-widest uppercase mb-2 text-white/60">
          <span>{lang === 'en' ? 'Focus' : 'फोकस'}</span>
          <span>{progress.focus}%</span>
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress.focus}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <button onClick={() => completeTask('focus')} className="mt-2 text-[10px] text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors cursor-none">
          + {lang === 'en' ? 'Complete Task' : 'टास्क पूरा करें'}
        </button>
      </div>
    </div>
  );
}

function FullScreenMode({ power, onClose, lang }: { power: any, onClose: () => void, lang: 'en' | 'hi' }) {
  const [step, setStep] = useState(0);
  const [showChallenge, setShowChallenge] = useState(false);

  useEffect(() => {
    if (power.audio) {
      try {
        localAudioEngine.play(power.audio);
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    }
    return () => {
      localAudioEngine.stop();
    };
  }, [power]);

  useEffect(() => {
    if (step < power.sequence.length) {
      const timer = setTimeout(() => {
        setStep(prev => prev + 1);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [step, power.sequence.length]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 overflow-hidden cursor-none"
    >
      {/* Slow red pulse background */}
      <motion.div 
        animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15)_0%,rgba(0,0,0,1)_70%)] pointer-events-none"
      />

      <button 
        onClick={onClose}
        className="absolute top-8 right-8 text-white/50 hover:text-white tracking-widest text-sm uppercase z-10 cursor-none"
      >
        {lang === 'en' ? 'Return' : 'वापस'}
      </button>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <AnimatePresence mode="wait">
          {step < power.sequence.length ? (
            <motion.h2
              key={step}
              initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.05 }}
              transition={{ duration: 1.5 }}
              className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tighter text-white"
            >
              {power.sequence[step]}
            </motion.h2>
          ) : (
            <motion.div
              key="challenge"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="flex flex-col items-center"
            >
              {!showChallenge ? (
                <button 
                  onClick={() => setShowChallenge(true)}
                  className="px-8 py-4 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all duration-500 tracking-[0.3em] uppercase text-sm font-bold cursor-none"
                >
                  {lang === 'en' ? 'Test Yourself' : 'खुद को आज़माओ'}
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 border border-white/20 bg-white/5 backdrop-blur-sm"
                >
                  <h3 className="text-red-500 text-xs tracking-[0.4em] uppercase mb-4">
                    {lang === 'en' ? 'Real Life Trigger' : 'असली चुनौती'}
                  </h3>
                  <p className="text-2xl md:text-3xl font-light text-white">
                    {power.challenge}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PowerCards({ powers, onSelect }: { powers: any[], onSelect: (power: any) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto my-12">
      {powers.map((power) => (
        <motion.div
          key={power.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(power)}
          className="group relative h-64 border border-white/10 bg-black overflow-hidden cursor-none flex flex-col items-center justify-center p-8 transition-colors duration-500 hover:border-red-500/50"
        >
          {/* Background Zoom */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 scale-150 group-hover:scale-100" />
          
          <h2 className="text-3xl md:text-4xl font-display font-light tracking-widest text-white/80 group-hover:text-white transition-colors duration-500 relative z-10">
            {power.title}
          </h2>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-black/80 backdrop-blur-sm z-20 p-6 text-center">
            <p className="text-red-500 font-light tracking-wide text-lg md:text-xl">
              "{power.hoverLine}"
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Power() {
  const { lang } = useLang();
  const [activePower, setActivePower] = useState<any>(null);
  
  // Daily rotation logic
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const powers = powersData[lang as 'en' | 'hi'];
  
  // Select 4 powers based on the day
  const currentPowers = [
    powers[dayIndex % powers.length],
    powers[(dayIndex + 1) % powers.length],
    powers[(dayIndex + 2) % powers.length],
    powers[(dayIndex + 3) % powers.length]
  ];

  return (
    <div className="min-h-screen bg-transparent pt-32 pb-24 px-6 md:px-12 lg:px-24 relative overflow-hidden">
      <AnimatePresence>
        {activePower && (
          <FullScreenMode 
            power={activePower} 
            onClose={() => setActivePower(null)} 
            lang={lang as 'en' | 'hi'} 
          />
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-5xl md:text-7xl font-light tracking-tighter mb-6">
            {lang === 'en' ? 'The Architecture of Power' : 'ताकत का ढांचा'}
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-lg font-light leading-relaxed">
            {lang === 'en' 
              ? 'Power is not control over others. It is absolute, terrifying control over oneself.' 
              : 'पावर दूसरों को कंट्रोल करना नहीं है। ये खुद पर ऐसा कंट्रोल है जो दूसरों को डरा दे।'}
          </p>
        </motion.div>

        <LiveLines lang={lang as 'en' | 'hi'} />
        
        <PowerCards powers={currentPowers} onSelect={setActivePower} />
        
        <SplitView lang={lang as 'en' | 'hi'} />
        
        <PowerMeter lang={lang as 'en' | 'hi'} />
      </div>
    </div>
  );
}
