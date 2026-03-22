import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getInnerVoiceResponse } from '../services/geminiService';
import { useLang } from '../context/LanguageContext';
import { Send, User, Bot, Trash2 } from 'lucide-react';

const CHARACTERS = [
  "Thomas Shelby",
  "Tywin Lannister",
  "Petyr Baelish",
  "Cersei Lannister",
  "Tyrion Lannister",
  "Madara Uchiha",
  "Itachi Uchiha",
  "Pain",
  "Shikamaru Nara",
  "Johan Liebert",
  "Kiyotaka Ayanokoji"
];

export default function Inner() {
  const { lang } = useLang();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'COUNCIL' | 'MENTOR'>(() => {
    return (localStorage.getItem('aura_inner_mode') as 'COUNCIL' | 'MENTOR') || 'COUNCIL';
  });
  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    return localStorage.getItem('aura_inner_character') || CHARACTERS[0];
  });
  const [messages, setMessages] = useState<{ id: string; text: string; isAi: boolean; character?: string }[]>(() => {
    try {
      const saved = localStorage.getItem('aura_inner_messages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('aura_inner_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('aura_inner_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('aura_inner_character', selectedCharacter);
  }, [selectedCharacter]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, text: userMessage, isAi: false }]);
    setInput('');
    setIsTyping(true);

    console.log("Submitting message:", userMessage);
    try {
      const response = await getInnerVoiceResponse(userMessage, mode, selectedCharacter, messages);
      console.log("Received response:", response);
      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }]);
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      const errorMsgId = (Date.now() + 2).toString();
      setMessages(prev => [...prev, { id: errorMsgId, text: "Silence.", isAi: true }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen bg-aura-black flex flex-col relative overflow-hidden pt-20 md:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.05)_0%,rgba(0,0,0,1)_70%)] pointer-events-none" />

      {/* Header / Mode Selection */}
      <div className="relative z-20 px-4 py-2 flex flex-col items-center gap-3 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="w-full flex justify-center items-center relative max-w-3xl mx-auto">
          <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
            <button
              onClick={() => { if (mode !== 'COUNCIL') { setMode('COUNCIL'); setMessages([]); } }}
              className={`px-4 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase transition-all ${mode === 'COUNCIL' ? 'bg-aura-red text-black font-bold' : 'text-white/40 hover:text-white'}`}
            >
              {lang === 'en' ? 'Council' : 'परिषद'}
            </button>
            <button
              onClick={() => { if (mode !== 'MENTOR') { setMode('MENTOR'); setMessages([]); } }}
              className={`px-4 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase transition-all ${mode === 'MENTOR' ? 'bg-aura-red text-black font-bold' : 'text-white/40 hover:text-white'}`}
            >
              {lang === 'en' ? 'Mentor' : 'गुरु'}
            </button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="absolute right-0 p-2 text-white/40 hover:text-aura-red transition-colors rounded-full hover:bg-white/5"
              title={lang === 'en' ? 'Clear Chat' : 'चैट मिटाएं'}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Character Selection (Only in MENTOR mode) */}
        <AnimatePresence>
          {mode === 'MENTOR' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-x-auto scrollbar-hide"
            >
              <div className="flex gap-2 px-2 pb-2 w-max mx-auto">
                {CHARACTERS.map(char => (
                  <button
                    key={char}
                    onClick={() => { if (selectedCharacter !== char) { setSelectedCharacter(char); setMessages([]); } }}
                    className={`px-3 py-1 text-[10px] whitespace-nowrap rounded-full border transition-all ${selectedCharacter === char ? 'border-aura-red text-aura-red bg-aura-red/10' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white'}`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative z-10 scroll-smooth scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
            <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center">
              <Bot size={32} className="text-aura-red" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-xs tracking-[0.3em] uppercase">
                {mode === 'COUNCIL' ? 'The Council Awaits' : `Consult ${selectedCharacter}`}
              </h3>
              <p className="text-[10px] tracking-widest uppercase">
                {lang === 'en' ? 'Ask your question' : 'अपना प्रश्न पूछें'}
              </p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`flex w-full ${msg.isAi ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.isAi ? 'items-start' : 'items-end'}`}>
                {msg.isAi && (
                  <span className="text-[9px] uppercase tracking-widest text-aura-red/60 mb-1 ml-2">
                    {msg.character || 'The Council'}
                  </span>
                )}
                <div
                  className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.isAi
                      ? 'bg-white/5 text-white/90 rounded-2xl rounded-bl-none border border-white/10'
                      : 'bg-aura-red text-black font-medium rounded-2xl rounded-br-none shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white/5 px-4 py-2 rounded-2xl rounded-bl-none border border-white/10 flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="relative z-20 p-4 bg-black/60 backdrop-blur-xl border-t border-white/5">
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-2 bg-white/5 rounded-full border border-white/10 px-4 py-2 focus-within:border-aura-red/50 transition-all"
        >
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
                e.currentTarget.style.height = 'auto';
              }
            }}
            rows={1}
            placeholder={mode === 'COUNCIL' 
              ? (lang === 'en' ? "Message the Council..." : "परिषद को संदेश भेजें...")
              : (lang === 'en' ? `Message ${selectedCharacter}...` : `${selectedCharacter} को संदेश भेजें...`)}
            className="flex-1 bg-transparent border-none py-2 text-sm text-white placeholder:text-white/20 focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2 rounded-full bg-aura-red text-black disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all hover:scale-105 active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="h-safe-bottom" /> {/* Handle safe area for mobile */}
      </div>
    </div>
  );
}
