import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getInnerVoiceResponse } from '../services/geminiService';
import { useLang } from '../context/LanguageContext';
import { Send, User, Bot, Trash2, ChevronDown, History, X, MessageSquare, Plus } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  mode: 'COUNCIL' | 'MENTOR';
  character: string;
  updatedAt: number;
}

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
  "Kiyotaka Ayanokoji",
  "Baki Hanma",
  "Hajime no Ippo",
  "Mike Tyson",
  "Muhammad Ali",
  "Bruce Lee",
  "Khabib Nurmagomedov",
  "Miyamoto Musashi"
];

export default function Inner() {
  const { lang } = useLang();
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('aura_chat_sessions');
      if (saved) return JSON.parse(saved);

      // Migration from old system
      const migratedSessions: ChatSession[] = [];
      const councilData = localStorage.getItem('aura_inner_messages_council');
      if (councilData) {
        const parsed = JSON.parse(councilData);
        if (parsed.length > 0) {
          const id = 'migrated_council';
          migratedSessions.push({ id, title: parsed[0].text.substring(0, 30) + '...', mode: 'COUNCIL', character: 'The Council', updatedAt: Date.now() });
          localStorage.setItem(`aura_chat_messages_${id}`, councilData);
        }
      }
      CHARACTERS.forEach(char => {
        const data = localStorage.getItem(`aura_inner_messages_${char.replace(/\s+/g, '_')}`);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.length > 0) {
            const id = `migrated_${char.replace(/\s+/g, '_')}`;
            migratedSessions.push({ id, title: parsed[0].text.substring(0, 30) + '...', mode: 'MENTOR', character: char, updatedAt: Date.now() });
            localStorage.setItem(`aura_chat_messages_${id}`, data);
          }
        }
      });
      if (migratedSessions.length > 0) {
        localStorage.setItem('aura_chat_sessions', JSON.stringify(migratedSessions));
      }
      return migratedSessions;
    } catch (e) { return []; }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const savedSessions = localStorage.getItem('aura_chat_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) return parsed[0].id;
      }
      return null;
    } catch (e) { return null; }
  });

  const [mode, setMode] = useState<'COUNCIL' | 'MENTOR'>(() => {
    try {
      const savedSessions = localStorage.getItem('aura_chat_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) return parsed[0].mode;
      }
      return (localStorage.getItem('aura_inner_mode') as 'COUNCIL' | 'MENTOR') || 'COUNCIL';
    } catch (e) {
      return 'COUNCIL';
    }
  });

  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    try {
      const savedSessions = localStorage.getItem('aura_chat_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0 && parsed[0].mode === 'MENTOR') return parsed[0].character;
      }
      return localStorage.getItem('aura_inner_character') || CHARACTERS[0];
    } catch (e) {
      return CHARACTERS[0];
    }
  });

  const [messages, setMessages] = useState<{ id: string; text: string; isAi: boolean; character?: string }[]>(() => {
    try {
      const savedSessions = localStorage.getItem('aura_chat_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) {
          const sessionId = parsed[0].id;
          const savedMsgs = localStorage.getItem(`aura_chat_messages_${sessionId}`);
          return savedMsgs ? JSON.parse(savedMsgs) : [];
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [isTyping, setIsTyping] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      try {
        localStorage.setItem(`aura_chat_messages_${currentSessionId}`, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_chat_sessions', JSON.stringify(sessions));
    } catch (e) {}
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_inner_mode', mode);
    } catch (e) {}
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_inner_character', selectedCharacter);
    } catch (e) {}
  }, [selectedCharacter]);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsHistoryOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMode(session.mode);
    if (session.mode === 'MENTOR') {
      setSelectedCharacter(session.character);
    }
    try {
      const saved = localStorage.getItem(`aura_chat_messages_${session.id}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setMessages([]);
    }
    setIsHistoryOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    localStorage.removeItem(`aura_chat_messages_${id}`);
    if (currentSessionId === id) {
      if (updatedSessions.length > 0) {
        loadSession(updatedSessions[0]);
      } else {
        startNewChat();
      }
    }
  };

  const clearCurrentChat = () => {
    setMessages([]);
    if (currentSessionId) {
      localStorage.removeItem(`aura_chat_messages_${currentSessionId}`);
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      setCurrentSessionId(null);
    }
  };

  const switchChat = (newMode: 'COUNCIL' | 'MENTOR', newChar: string) => {
    setMode(newMode);
    setSelectedCharacter(newChar);
  };

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
    const newMessages = [...messages, { id: userMsgId, text: userMessage, isAi: false }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    let sessionId = currentSessionId;
    let isNewSession = false;

    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      isNewSession = true;
    }

    setSessions(prev => {
      if (isNewSession) {
        return [{
          id: sessionId!,
          title: userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage,
          mode,
          character: mode === 'COUNCIL' ? 'The Council' : selectedCharacter,
          updatedAt: Date.now()
        }, ...prev];
      } else {
        return prev.map(s => s.id === sessionId ? { 
          ...s, 
          mode, 
          character: mode === 'COUNCIL' ? 'The Council' : selectedCharacter, 
          updatedAt: Date.now() 
        } : s).sort((a, b) => b.updatedAt - a.updatedAt);
      }
    });

    try {
      localStorage.setItem(`aura_chat_messages_${sessionId}`, JSON.stringify(newMessages));
    } catch (e) {}

    console.log("Submitting message:", userMessage);
    try {
      const response = await getInnerVoiceResponse(userMessage, mode, selectedCharacter, newMessages.slice(0, -1));
      console.log("Received response:", response);
      const aiMsgId = (Date.now() + 1).toString();
      const finalMessages = [...newMessages, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }];
      setMessages(finalMessages);
      try {
        localStorage.setItem(`aura_chat_messages_${sessionId}`, JSON.stringify(finalMessages));
      } catch (e) {}
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      const errorMsgId = (Date.now() + 2).toString();
      const finalMessages = [...newMessages, { id: errorMsgId, text: "Silence.", isAi: true }];
      setMessages(finalMessages);
      try {
        localStorage.setItem(`aura_chat_messages_${sessionId}`, JSON.stringify(finalMessages));
      } catch (e) {}
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen bg-aura-black flex flex-col relative overflow-hidden pt-20 md:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.05)_0%,rgba(0,0,0,1)_70%)] pointer-events-none" />

      {/* Header / Mode Selection */}
      <div className="relative z-20 px-4 py-3 flex flex-col items-center gap-4 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="w-full flex justify-between items-center max-w-3xl mx-auto">
          {/* Left: History & New Chat */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10 bg-white/5 border border-white/10"
              title={lang === 'en' ? 'Chat History' : 'चैट हिस्ट्री'}
            >
              <History size={18} />
            </button>
            <button
              onClick={startNewChat}
              className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10 bg-white/5 border border-white/10"
              title={lang === 'en' ? 'New Chat' : 'नई चैट'}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Center: Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/10">
            <button
              onClick={() => { if (mode !== 'COUNCIL') { switchChat('COUNCIL', selectedCharacter); } }}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs tracking-[0.2em] uppercase transition-all ${mode === 'COUNCIL' ? 'bg-aura-red text-black font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/40 hover:text-white'}`}
            >
              {lang === 'en' ? 'Council' : 'परिषद'}
            </button>
            <button
              onClick={() => { if (mode !== 'MENTOR') { switchChat('MENTOR', selectedCharacter); } }}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs tracking-[0.2em] uppercase transition-all ${mode === 'MENTOR' ? 'bg-aura-red text-black font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/40 hover:text-white'}`}
            >
              {lang === 'en' ? 'Mentor' : 'गुरु'}
            </button>
          </div>
          
          {/* Right: Clear Chat (Placeholder to keep center aligned if empty) */}
          <div className="flex items-center justify-end w-[88px]">
            {messages.length > 0 && (
              <button
                onClick={clearCurrentChat}
                className="p-2 text-white/40 hover:text-aura-red transition-colors rounded-full hover:bg-white/10"
                title={lang === 'en' ? 'Clear Chat' : 'चैट मिटाएं'}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Character Selection (Only in MENTOR mode) */}
        <AnimatePresence>
          {mode === 'MENTOR' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full relative mt-3 z-50 flex justify-center"
            >
              <button
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                className="flex items-center gap-3 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-xs tracking-widest uppercase text-white shadow-lg"
              >
                <span className="text-white/50">{lang === 'en' ? 'Mentor:' : 'गुरु:'}</span>
                <span className="text-aura-red font-bold">{selectedCharacter}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 text-white/50 ${isSelectorOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSelectorOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 10, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-4 right-4 md:left-auto md:right-auto md:w-[600px] bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
                        {CHARACTERS.map(char => (
                          <button
                            key={char}
                            onClick={() => {
                              if (selectedCharacter !== char) switchChat('MENTOR', char);
                              setIsSelectorOpen(false);
                            }}
                            className={`px-4 py-3 text-[10px] md:text-xs font-medium tracking-wider uppercase rounded-xl transition-all text-left flex items-center justify-between group ${
                              selectedCharacter === char
                                ? 'bg-aura-red text-black shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/5'
                            }`}
                          >
                            <span className="truncate">{char}</span>
                            {selectedCharacter === char && (
                              <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat History Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#0a0a0a] border-r border-white/10 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h2 className="text-sm font-bold tracking-widest uppercase text-white flex items-center gap-2">
                  <History size={16} className="text-aura-red" />
                  {lang === 'en' ? 'Chat History' : 'चैट हिस्ट्री'}
                </h2>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {sessions.length === 0 ? (
                  <div className="text-center text-white/30 text-xs mt-10 uppercase tracking-wider">
                    {lang === 'en' ? 'No chat history yet' : 'कोई चैट हिस्ट्री नहीं'}
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={`w-full text-left p-3 rounded-xl border transition-all group cursor-pointer relative ${
                        currentSessionId === session.id
                          ? 'bg-aura-red/10 border-aura-red/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 pr-6">
                        <span className={`text-xs font-bold uppercase tracking-wider truncate ${
                          currentSessionId === session.id
                            ? 'text-aura-red'
                            : 'text-white/80 group-hover:text-white'
                        }`}>
                          {session.character}
                        </span>
                        <span className="text-[9px] text-white/30 whitespace-nowrap">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/50 line-clamp-1 leading-relaxed pr-6">
                        {session.title}
                      </p>
                      <button
                        onClick={(e) => deleteSession(e, session.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/20 hover:text-aura-red opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-white/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
