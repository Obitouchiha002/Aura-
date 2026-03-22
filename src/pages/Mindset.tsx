import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { useState, useEffect } from 'react';

const quotesData = {
  en: [
    {
      id: 'madara',
      author: 'Madara Uchiha',
      title: 'Reality',
      hoverLine: 'Wake up to reality.',
      sequence: [
        'Nothing ever goes as planned in this accursed world.',
        'The longer you live, the more you realize that the only things that truly exist in this reality are merely pain, suffering and futility.'
      ],
      challenge: 'Accept the harsh truths of your life without complaining today.'
    },
    {
      id: 'itachi',
      author: 'Itachi Uchiha',
      title: 'Illusion',
      hoverLine: 'People live their lives bound by what they accept as correct and true.',
      sequence: [
        'That is how they define "reality".',
        'But what does it mean to be "correct" or "true"? Merely vague concepts... Their "reality" may all be a mirage.'
      ],
      challenge: 'Question one deeply held belief you have today.'
    },
    {
      id: 'ayanokoji',
      author: 'Kiyotaka Ayanokoji',
      title: 'Tools',
      hoverLine: 'I\'ve never once thought of you as an ally.',
      sequence: [
        'All people are nothing but tools.',
        'It doesn\'t matter how it\'s done. It doesn\'t matter what needs to be sacrificed. In this world, winning is everything.'
      ],
      challenge: 'Make a decision based purely on logic and outcome, ignoring emotion.'
    },
    {
      id: 'johan',
      author: 'Johan Liebert',
      title: 'Equality',
      hoverLine: 'The only thing all humans are equal in is death.',
      sequence: [
        'There is nothing special about being born. Not a thing.',
        'Most of the universe is just death, nothing more.'
      ],
      challenge: 'Embrace your mortality. Spend 10 minutes meditating on the end.'
    },
    {
      id: 'tywin',
      author: 'Tywin Lannister',
      title: 'Legacy',
      hoverLine: 'A lion doesn\'t concern himself with the opinions of the sheep.',
      sequence: [
        'It\'s the family name that lives on. It\'s all that lives on.',
        'Not your personal glory, not your honor... but family.'
      ],
      challenge: 'Ignore one piece of unhelpful criticism today.'
    },
    {
      id: 'cersei',
      author: 'Cersei Lannister',
      title: 'Power',
      hoverLine: 'Power is power.',
      sequence: [
        'When you play the game of thrones, you win or you die.',
        'There is no middle ground.'
      ],
      challenge: 'Take absolute control of a situation you usually avoid.'
    },
    {
      id: 'littlefinger',
      author: 'Petyr Baelish',
      title: 'Chaos',
      hoverLine: 'Chaos isn\'t a pit. Chaos is a ladder.',
      sequence: [
        'Many who try to climb it fail and never get to try again. The fall breaks them.',
        'Only the ladder is real. The climb is all there is.'
      ],
      challenge: 'Find an opportunity in a chaotic situation today.'
    },
    {
      id: 'tyrion',
      author: 'Tyrion Lannister',
      title: 'Armor',
      hoverLine: 'Never forget what you are, the rest of the world will not.',
      sequence: [
        'Wear it like armor, and it can never be used to hurt you.',
        'A mind needs books as a sword needs a whetstone, if it is to keep its edge.'
      ],
      challenge: 'Acknowledge your biggest flaw and own it.'
    },
    {
      id: 'daenerys',
      author: 'Daenerys Targaryen',
      title: 'Destiny',
      hoverLine: 'I am not going to stop the wheel. I am going to break the wheel.',
      sequence: [
        'I will take what is mine with fire and blood.',
        'Yes, all men must die, but we are not men.'
      ],
      challenge: 'Refuse to conform to a rule that holds you back.'
    },
    {
      id: 'arya',
      author: 'Arya Stark',
      title: 'Death',
      hoverLine: 'Leave one wolf alive and the sheep are never safe.',
      sequence: [
        'What do we say to the God of Death?',
        'Not today.'
      ],
      challenge: 'Face a fear you have been avoiding.'
    },
    {
      id: 'hound',
      author: 'Sandor Clegane',
      title: 'Reality',
      hoverLine: 'There are no divine justices, only men with swords.',
      sequence: [
        'Hate\'s as good a thing as any to keep a person going.',
        'Better than most.'
      ],
      challenge: 'Channel your anger into something productive.'
    }
  ],
  hi: [
    {
      id: 'madara',
      author: 'मादारा उचिहा',
      title: 'हकीकत',
      hoverLine: 'हकीकत का सामना करो।',
      sequence: [
        'इस शापित दुनिया में कभी कुछ भी प्लान के हिसाब से नहीं होता।',
        'तुम जितना ज्यादा जिओगे, उतना ही समझोगे कि इस दुनिया में सिर्फ दर्द, तकलीफ और निराशा ही असली है।'
      ],
      challenge: 'आज अपनी जिंदगी के कड़वे सच को बिना शिकायत के स्वीकार करो।'
    },
    {
      id: 'itachi',
      author: 'इताची उचिहा',
      title: 'भ्रम',
      hoverLine: 'लोग अपनी जिंदगी उसी सच के सहारे जीते हैं जिसे वो सही मानते हैं।',
      sequence: [
        'इसी को वो "हकीकत" कहते हैं।',
        'लेकिन "सही" या "सच" का मतलब क्या है? ये सिर्फ धुंधले खयाल हैं... उनकी "हकीकत" सिर्फ एक धोखा हो सकती है।'
      ],
      challenge: 'आज अपनी किसी एक गहरी मान्यता पर सवाल उठाओ।'
    },
    {
      id: 'ayanokoji',
      author: 'कियोताका अयानोकोजी',
      title: 'हथियार',
      hoverLine: 'मैंने तुम्हें कभी अपना साथी नहीं माना।',
      sequence: [
        'सब लोग सिर्फ इस्तेमाल करने की चीज़ें हैं।',
        'इससे कोई फर्क नहीं पड़ता कि काम कैसे होता है या क्या दांव पर लगता है। इस दुनिया में जीत ही सब कुछ है।'
      ],
      challenge: 'भावनाओं को दरकिनार कर, सिर्फ तर्क और नतीजे के आधार पर एक फैसला लें।'
    },
    {
      id: 'johan',
      author: 'जोहान लिबर्ट',
      title: 'समानता',
      hoverLine: 'मौत ही एक ऐसी चीज़ है जिसमें सारे इंसान बराबर हैं।',
      sequence: [
        'पैदा होने में कुछ भी खास नहीं है। कुछ भी नहीं।',
        'ज्यादातर ब्रह्मांड सिर्फ मौत है, और कुछ नहीं।'
      ],
      challenge: 'अपनी नश्वरता को अपनाएं। 10 मिनट तक अंत के बारे में ध्यान करें।'
    },
    {
      id: 'tywin',
      author: 'टायविन लैनिस्टर',
      title: 'विरासत',
      hoverLine: 'एक शेर कभी भेड़ों की राय की परवाह नहीं करता।',
      sequence: [
        'सिर्फ परिवार का नाम ही ज़िंदा रहता है। बस वही बचता है।',
        'तुम्हारी अपनी शान या सम्मान नहीं... बल्कि परिवार।'
      ],
      challenge: 'आज किसी एक बेकार आलोचना को नज़रअंदाज़ करें।'
    },
    {
      id: 'cersei',
      author: 'सर्सी लैनिस्टर',
      title: 'सत्ता',
      hoverLine: 'सत्ता ही असली ताकत है।',
      sequence: [
        'जब तुम गेम ऑफ थ्रोन्स खेलते हो, तो या तो तुम जीतते हो या मर जाते हो।',
        'बीच का कोई रास्ता नहीं है।'
      ],
      challenge: 'आज किसी ऐसी स्थिति पर पूरा नियंत्रण लें जिससे आप अक्सर बचते हैं।'
    },
    {
      id: 'littlefinger',
      author: 'पेटिर बेलिश',
      title: 'अराजकता',
      hoverLine: 'अराजकता कोई गड्ढा नहीं है। अराजकता एक सीढ़ी है।',
      sequence: [
        'जो लोग इस पर चढ़ने की कोशिश करते हैं और गिर जाते हैं, वो टूट जाते हैं।',
        'सिर्फ सीढ़ी ही सच है। बस चढ़ते जाना ही सब कुछ है।'
      ],
      challenge: 'आज किसी अराजक स्थिति में एक अवसर खोजें।'
    },
    {
      id: 'tyrion',
      author: 'टिरियन लैनिस्टर',
      title: 'कवच',
      hoverLine: 'कभी मत भूलो कि तुम क्या हो, बाकी दुनिया नहीं भूलेगी।',
      sequence: [
        'इसे कवच की तरह पहनो, और इसका इस्तेमाल तुम्हें चोट पहुँचाने के लिए कभी नहीं किया जा सकेगा।',
        'दिमाग को किताबों की उतनी ही ज़रूरत होती है जितनी तलवार को धार की, अगर उसे तेज़ रहना है।'
      ],
      challenge: 'अपनी सबसे बड़ी खामी को स्वीकार करें और उसे अपनाएं।'
    },
    {
      id: 'daenerys',
      author: 'डेनेरीस टार्गेरियन',
      title: 'नियति',
      hoverLine: 'मैं पहिये को रोकने नहीं जा रही हूँ। मैं पहिये को तोड़ने जा रही हूँ।',
      sequence: [
        'जो मेरा है, मैं उसे आग और खून से ले लूंगी।',
        'हाँ, सभी इंसानों को मरना है, लेकिन हम इंसान नहीं हैं।'
      ],
      challenge: 'उस नियम को मानने से इंकार करें जो आपको पीछे खींच रहा है।'
    },
    {
      id: 'arya',
      author: 'आर्या स्टार्क',
      title: 'मौत',
      hoverLine: 'एक भेड़िये को ज़िंदा छोड़ दो और भेड़ें कभी सुरक्षित नहीं रहेंगी।',
      sequence: [
        'हम मौत के देवता से क्या कहते हैं?',
        'आज नहीं।'
      ],
      challenge: 'उस डर का सामना करें जिससे आप बचते रहे हैं।'
    },
    {
      id: 'hound',
      author: 'सैंडोर क्लीगेन',
      title: 'हकीकत',
      hoverLine: 'कोई दैवीय न्याय नहीं है, सिर्फ तलवार वाले इंसान हैं।',
      sequence: [
        'नफरत किसी को भी आगे बढ़ाते रहने के लिए काफी अच्छी चीज़ है।',
        'ज़्यादातर से बेहतर।'
      ],
      challenge: 'अपने गुस्से को किसी उत्पादक काम में लगाएँ।'
    }
  ]
};

function FullScreenMode({ quote, onClose, lang }: { quote: any, onClose: () => void, lang: 'en' | 'hi' }) {
  const [step, setStep] = useState(0);
  const [showChallenge, setShowChallenge] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'Enter') {
        if (step < quote.sequence.length - 1) {
          setStep(s => s + 1);
        } else {
          setShowChallenge(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, quote, onClose]);

  const handleNext = () => {
    if (step < quote.sequence.length - 1) {
      setStep(s => s + 1);
    } else {
      setShowChallenge(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 cursor-pointer"
      onClick={handleNext}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-8 right-8 text-white/50 hover:text-white uppercase tracking-widest text-xs"
      >
        {lang === 'en' ? 'Close [ESC]' : 'बंद करें [ESC]'}
      </button>

      <div className="absolute top-8 left-8 text-red-500/50 uppercase tracking-[0.3em] text-xs font-display">
        {quote.author}
      </div>

      <AnimatePresence mode="wait">
        {!showChallenge ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl text-center"
          >
            <h2 className="text-4xl md:text-6xl lg:text-8xl font-display font-light tracking-tighter leading-tight">
              "{quote.sequence[step]}"
            </h2>
          </motion.div>
        ) : (
          <motion.div
            key="challenge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl text-center border border-red-500/30 p-12 bg-red-500/5"
          >
            <h3 className="text-red-500 uppercase tracking-[0.3em] text-sm mb-6 font-display">
              {lang === 'en' ? 'Daily Directive' : 'दैनिक निर्देश'}
            </h3>
            <p className="text-2xl md:text-3xl font-light leading-relaxed">
              {quote.challenge}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {!showChallenge && quote.sequence.map((_: any, i: number) => (
          <div 
            key={i} 
            className={`h-1 transition-all duration-500 ${i === step ? 'w-8 bg-red-500' : 'w-2 bg-white/20'}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function Mindset() {
  const { lang } = useLang();
  const [activeQuote, setActiveQuote] = useState<any | null>(null);

  // Daily rotation logic
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const quotes = lang === 'en' ? quotesData.en : quotesData.hi;
  
  // Select 4 quotes based on the day
  const dailyQuotes = [
    quotes[dayIndex % quotes.length],
    quotes[(dayIndex + 1) % quotes.length],
    quotes[(dayIndex + 2) % quotes.length],
    quotes[(dayIndex + 3) % quotes.length]
  ];

  return (
    <div className="min-h-screen bg-transparent pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <h1 className="font-display text-5xl md:text-7xl font-light tracking-tighter mb-6">
            {lang === 'en' ? 'The Mindset' : 'मानसिकता'}
          </h1>
          <div className="w-24 h-[1px] bg-red-500" />
          <p className="mt-6 text-white/50 text-sm tracking-widest uppercase">
            {lang === 'en' ? 'Daily Quotes' : 'दैनिक विचार'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {dailyQuotes.map((quote, index) => (
            <motion.div
              key={quote.id + index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              onClick={() => setActiveQuote(quote)}
              className="group relative border border-white/10 p-8 md:p-12 cursor-pointer overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex justify-between items-start mb-12">
                <h2 className="font-display text-3xl md:text-4xl font-light tracking-tight">
                  {quote.title}
                </h2>
                <span className="text-red-500 font-mono text-sm">0{index + 1}</span>
              </div>
              
              <div className="h-24">
                <p className="text-white/40 group-hover:text-white/80 transition-colors duration-300 font-light text-lg">
                  "{quote.hoverLine}"
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs uppercase tracking-[0.2em] text-white/30 group-hover:text-red-500/70 transition-colors">
                  {quote.author}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-white/30 group-hover:text-white transition-colors">
                  {lang === 'en' ? 'Enter' : 'प्रवेश'} →
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeQuote && (
          <FullScreenMode 
            quote={activeQuote} 
            onClose={() => setActiveQuote(null)} 
            lang={lang} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
