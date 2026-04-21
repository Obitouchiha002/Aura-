import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { getInnerVoiceResponse, getInnerVoiceImageResponse } from '../services/geminiService';
import { generateImage } from '../services/nvidiaService';
import { useSettings } from '../context/SettingsContext';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, User, Bot, Trash2, ChevronDown, History, X, MessageSquare, Plus, Settings as SettingsIcon, RefreshCcw, Image as ImageIcon, Users, Sparkles, Target, Gamepad2, Volume2, Square } from 'lucide-react';
import { Settings } from '../components/Settings';
import { useTTS } from '../hooks/useTTS';
import Focus from './Focus';
import Simulator from './Simulator';

const CHARACTERS = [
  "Thomas Shelby", "Tywin Lannister", "Petyr Baelish", "Cersei Lannister", "Tyrion Lannister",
  "Madara Uchiha", "Itachi Uchiha", "Pain", "Shikamaru Nara", "Johan Liebert", "Kiyotaka Ayanokoji",
  "L (Death Note)", "Sosuke Aizen (Bleach)", "Senku Ishigami (Dr. Stone)", "Chanakya (चाणक्य)",
  "Sun Tzu (The Art of War)", "Niccolò Machiavelli", "Harvey Specter (Suits)", "Gustavo Fring (Breaking Bad)"
];

interface ChatSession {
  id: string;
  title: string;
  mode: 'COUNCIL' | 'MENTOR';
  character: string;
  updatedAt: number;
  messages?: any[];
}

function HistoryDrawerComponent({ isOpen, onClose, sessions, loadSession, currentSessionId, deleteSession, lang }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-black border-r border-white/10 flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h2 className="text-sm font-bold tracking-widest uppercase text-white flex items-center gap-2">
            <History size={16} className="text-aura-red" />
            {lang === 'en' ? 'Chat History' : 'चैट हिस्ट्री'}
          </h2>
          <button
            onClick={onClose}
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
            sessions.map((session: any) => (
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
                      : 'text-white'
                  }`}>
                    {session.character}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[10px] text-white/50 truncate">{session.title}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-aura-red opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Inner() {
  const { lang } = useLang();
  const { hapticFeedback, vibration, userApiKey, language } = useSettings();
  const { checkAndIncrementMessageLimit, user } = useAuth();

  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<'COUNCIL' | 'MENTOR'>('COUNCIL');
  const [selectedCharacter, setSelectedCharacter] = useState(CHARACTERS[0]);
  const [messages, setMessages] = useState<{ id: string; text: string; isAi: boolean; character?: string; imageUrl?: string; isImageRequest?: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [inputAction, setInputAction] = useState<'CHAT' | 'IMAGE'>('CHAT');
  const [showActionMenu, setShowActionMenu] = useState(false);

  const { speakingId, speak, stop } = useTTS(lang);

  const [hash, setHash] = useState(window.location.hash || '#chat');
  const previousViewRef = useRef<'chat' | 'focus' | 'simulator'>('chat');

  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash;
      if (newHash === '#chat' || newHash === '#focus' || newHash === '#simulator') {
        previousViewRef.current = newHash.replace('#', '') as 'chat' | 'focus' | 'simulator';
      }
      setHash(newHash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Determine the current view. If a modal is open, keep the underlying view active.
  const view = (hash === '#chat' || hash === '#focus' || hash === '#simulator') 
    ? (hash.replace('#', '') as 'chat' | 'focus' | 'simulator') 
    : previousViewRef.current;

  const isSettingsOpen = hash === '#settings';
  const isHistoryOpen = hash === '#history';
  const isSelectorOpen = hash === '#selector';

  const closeModals = () => {
    window.location.hash = previousViewRef.current;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const triggerHaptic = () => {
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const triggerVibration = () => {
    if (vibration && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setMessages([]);
      setCurrentSessionId(null);
      return;
    }
    
    const loadData = async () => {
      try {
        const q = query(collection(db, 'users', user.uid, 'chatSessions'), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        const fetchedSessions = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            mode: data.mode,
            character: data.character,
            updatedAt: data.updatedAt,
            messages: data.messages || []
          } as ChatSession;
        });
        
        setSessions(fetchedSessions);
        // Do not auto-load the first session. Start with a new chat.
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    };
    loadData();
  }, [user]);

  // Sync messages and session metadata to Firestore
  useEffect(() => {
    if (!user || !currentSessionId) return;
    const sessionMeta = sessions.find(s => s.id === currentSessionId);
    if (sessionMeta) {
      const sanitizedMessages = messages.map(msg => {
        const sanitized = { ...msg };
        Object.keys(sanitized).forEach(key => {
          if (sanitized[key as keyof typeof sanitized] === undefined) {
            delete sanitized[key as keyof typeof sanitized];
          }
        });
        return sanitized;
      });

      const sanitizedMeta = { ...sessionMeta };
      Object.keys(sanitizedMeta).forEach(key => {
        if (sanitizedMeta[key as keyof typeof sanitizedMeta] === undefined) {
          delete sanitizedMeta[key as keyof typeof sanitizedMeta];
        }
      });

      setDoc(doc(db, 'users', user.uid, 'chatSessions', currentSessionId), {
        ...sanitizedMeta,
        messages: sanitizedMessages
      }, { merge: true }).catch(console.error);
    }
  }, [messages, sessions, currentSessionId, user]);

  useEffect(() => {
    try {
      localStorage.setItem('aura_inner_mode', mode);
      localStorage.setItem('aura_inner_character', selectedCharacter);
    } catch (e) {}
  }, [mode, selectedCharacter]);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    window.location.hash = 'chat';
  };

  const loadSession = (session: ChatSession) => {
    triggerHaptic();
    setCurrentSessionId(session.id);
    setMode(session.mode);
    if (session.mode === 'MENTOR') {
      setSelectedCharacter(session.character);
    }
    setMessages(session.messages || []);
    window.location.hash = 'chat';
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    triggerHaptic();
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'chatSessions', id)).catch(console.error);
    }

    if (currentSessionId === id) {
      if (updatedSessions.length > 0) {
        loadSession(updatedSessions[0]);
      } else {
        startNewChat();
      }
    }
  };

  const clearCurrentChat = () => {
    triggerHaptic();
    setMessages([]);
    if (currentSessionId) {
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      if (user) {
        deleteDoc(doc(db, 'users', user.uid, 'chatSessions', currentSessionId)).catch(console.error);
      }
      setCurrentSessionId(null);
    }
  };

  const switchChat = (newMode: 'COUNCIL' | 'MENTOR', newChar: string) => {
    if (mode !== newMode) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    setMode(newMode);
    setSelectedCharacter(newChar);
    if (isSelectorOpen) {
      window.history.back();
    }
  };

  const bringToCouncil = async () => {
    if (mode !== 'MENTOR' || messages.length === 0) return;
    
    triggerHaptic();
    
    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    let currentMessages = messages;
    if (justReachedLimit) {
      const limitMsgId = Date.now().toString() + "_limit";
      const limitMsg = lang === 'en' 
        ? "[System] Daily premium limit reached. Automatically switching to the free version." 
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      currentMessages = [...currentMessages, { id: limitMsgId, text: limitMsg, isAi: true }];
      setMessages(currentMessages);
    }

    const transitionMsg = lang === 'en' 
      ? `I was discussing this with ${selectedCharacter}. Council, what are your collective thoughts on our conversation?`
      : `मैं ${selectedCharacter} के साथ इस पर चर्चा कर रहा था। परिषद, हमारी बातचीत पर आपके सामूहिक विचार क्या हैं?`;
      
    const userMsgId = Date.now().toString();
    const newMessages = [...currentMessages, { id: userMsgId, text: transitionMsg, isAi: false }];
    setMessages(newMessages);
    setMode('COUNCIL');
    setIsTyping(true);
    
    if (currentSessionId) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? {
        ...s,
        mode: 'COUNCIL',
        character: 'The Council',
        updatedAt: Date.now()
      } : s));
    }

    try {
      const response = await getInnerVoiceResponse(transitionMsg, 'COUNCIL', 'The Council', currentMessages, userApiKey, language, isFreeTier);
      const aiMsgId = (Date.now() + 1).toString();
      const finalMessages = [...newMessages, { id: aiMsgId, text: response, isAi: true }];
      setMessages(finalMessages);
    } catch (error) {
      const errorMsgId = (Date.now() + 2).toString();
      setMessages([...newMessages, { id: errorMsgId, text: "[System Error] Failed to consult the Council.", isAi: true }]);
    } finally {
      setIsTyping(false);
    }
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
    if (!input.trim() || isTyping) return;

    triggerHaptic();

    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    let currentMessages = messages;
    if (justReachedLimit) {
      const limitMsgId = Date.now().toString() + "_limit";
      const limitMsg = lang === 'en' 
        ? "[System] Daily premium limit reached. Automatically switching to the free version." 
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      currentMessages = [...currentMessages, { id: limitMsgId, text: limitMsg, isAi: true }];
      setMessages(currentMessages);
    }

    const userMessage = input.trim();
    const userMsgId = Date.now().toString();
    const isImageReq = inputAction === 'IMAGE';
    const newMessages = [...currentMessages, { id: userMsgId, text: userMessage, isAi: false, isImageRequest: isImageReq }];
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

    console.log("Submitting message:", userMessage);
    try {
      if (isImageReq) {
        setIsGeneratingImage(true);
        const { dialogue, imagePrompt } = await getInnerVoiceImageResponse(userMessage, mode, selectedCharacter, newMessages.slice(0, -1), userApiKey, language, isFreeTier);
        const apiKey = "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";
        const imageUrl = await generateImage(imagePrompt, apiKey);
        const aiMsgId = (Date.now() + 1).toString();
        const finalMessages = [...newMessages, { id: aiMsgId, text: dialogue, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined, imageUrl }];
        setMessages(finalMessages);
        setIsGeneratingImage(false);
      } else {
        const response = await getInnerVoiceResponse(userMessage, mode, selectedCharacter, newMessages.slice(0, -1), userApiKey, language, isFreeTier);
        console.log("Received response:", response);
        const aiMsgId = (Date.now() + 1).toString();
        const finalMessages = [...newMessages, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }];
        setMessages(finalMessages);
      }
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      setIsGeneratingImage(false);
      const errorMsgId = (Date.now() + 2).toString();
      const errorMessage = error?.message || "Failed to generate response.";
      const finalMessages = [...newMessages, { id: errorMsgId, text: `[System Error] ${errorMessage}`, isAi: true }];
      setMessages(finalMessages);
    } finally {
      setIsTyping(false);
    }
  };

  const retryLastMessage = async () => {
    const lastUserMsg = [...messages].reverse().find(m => !m.isAi);
    if (!lastUserMsg || isTyping) return;
    
    // Remove the error message if it's the last one
    if (messages[messages.length - 1].isAi && messages[messages.length - 1].text.startsWith('[System Error]')) {
      setMessages(prev => prev.slice(0, -1));
    }
    
    setInput(lastUserMsg.text);
    // We can't easily call handleSubmit directly because of the event, 
    // but we can trigger the logic.
    // Actually, let's just re-run the logic but skip adding the user message again.
    
    triggerHaptic();
    
    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    let currentMessages = messages[messages.length - 1].isAi && messages[messages.length - 1].text.startsWith('[System Error]')
      ? messages.slice(0, -1)
      : messages;

    if (justReachedLimit) {
      const limitMsgId = Date.now().toString() + "_limit";
      const limitMsg = lang === 'en' 
        ? "[System] Daily premium limit reached. Automatically switching to the free version." 
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      currentMessages = [...currentMessages, { id: limitMsgId, text: limitMsg, isAi: true }];
      setMessages(currentMessages);
    }

    setIsTyping(true);

    const isImageReq = lastUserMsg.isImageRequest;

    try {
      if (isImageReq) {
        setIsGeneratingImage(true);
        const { dialogue, imagePrompt } = await getInnerVoiceImageResponse(lastUserMsg.text, mode, selectedCharacter, currentMessages.filter(m => m.id !== lastUserMsg.id), userApiKey, language, isFreeTier);
        const apiKey = "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";
        const imageUrl = await generateImage(imagePrompt, apiKey);
        const aiMsgId = (Date.now() + 1).toString();
        const finalMessages = [...currentMessages, { id: aiMsgId, text: dialogue, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined, imageUrl }];
        setMessages(finalMessages);
        setIsGeneratingImage(false);
      } else {
        const response = await getInnerVoiceResponse(lastUserMsg.text, mode, selectedCharacter, currentMessages.filter(m => m.id !== lastUserMsg.id), userApiKey, language, isFreeTier);
        const aiMsgId = (Date.now() + 1).toString();
        const finalMessages = [...currentMessages, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }];
        setMessages(finalMessages);
      }
    } catch (error: any) {
      setIsGeneratingImage(false);
      const errorMsgId = (Date.now() + 2).toString();
      const errorMessage = error?.message || "The connection failed again. Please wait a moment.";
      setMessages([...currentMessages, { id: errorMsgId, text: `[System Error] ${errorMessage}`, isAi: true }]);
    } finally {
      setIsTyping(false);
      setInput('');
    }
  };

  return (
    <div className="h-screen bg-aura-black flex flex-col relative overflow-hidden pt-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.05)_0%,rgba(0,0,0,1)_70%)] pointer-events-none" />

      {/* Header / Mode Selection */}
      <div className="relative z-20 px-4 py-2 flex flex-col items-center gap-2 border-b border-white/5 bg-black/40 backdrop-blur-md">
        {view === 'chat' && (
          <div className="w-full flex justify-between items-center max-w-3xl mx-auto">
            {/* Left: History & New Chat */}
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => { triggerHaptic(); window.location.hash = 'history'; }}
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
                onClick={() => { if (mode !== 'COUNCIL') { triggerHaptic(); switchChat('COUNCIL', selectedCharacter); } }}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs tracking-[0.2em] uppercase transition-all ${mode === 'COUNCIL' ? 'bg-aura-red text-black font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/40 hover:text-white'}`}
              >
                {lang === 'en' ? 'Council' : 'परिषद'}
              </button>
              <button
                onClick={() => { if (mode !== 'MENTOR') { triggerHaptic(); switchChat('MENTOR', selectedCharacter); } }}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs tracking-[0.2em] uppercase transition-all ${mode === 'MENTOR' ? 'bg-aura-red text-black font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/40 hover:text-white'}`}
              >
                {lang === 'en' ? 'Mentor' : 'गुरु'}
              </button>
            </div>
            
            {/* Right: Clear Chat & Settings */}
            <div className="flex items-center justify-end gap-2 flex-1">
              {messages.length > 0 && (
                <button
                  onClick={clearCurrentChat}
                  className="p-2 text-white/40 hover:text-aura-red transition-colors rounded-full hover:bg-white/10"
                  title={lang === 'en' ? 'Clear Chat' : 'चैट मिटाएं'}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={() => { triggerHaptic(); window.location.hash = 'settings'; }}
                className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10 bg-white/5 border border-white/10"
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {view === 'chat' ? (
        <>
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
                onClick={() => { triggerHaptic(); window.location.hash = isSelectorOpen ? 'chat' : 'selector'; }}
                className="flex items-center gap-3 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-xs tracking-widest uppercase text-white shadow-lg"
              >
                <span className="text-white/50">{lang === 'en' ? 'Mentor:' : 'गुरु:'}</span>
                <span className="text-aura-red font-bold">{selectedCharacter}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 text-white/50 ${isSelectorOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => window.location.hash = 'chat'} />
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
                              window.location.hash = 'chat';
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

      <HistoryDrawerComponent
        isOpen={isHistoryOpen}
        onClose={closeModals}
        sessions={sessions}
        loadSession={loadSession}
        currentSessionId={currentSessionId}
        deleteSession={deleteSession}
        lang={lang}
      />

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 scroll-smooth scrollbar-hide overflow-x-hidden"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mode + (currentSessionId || 'new')}
            initial={{ opacity: 0, x: mode === 'COUNCIL' ? -20 : 20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: mode === 'COUNCIL' ? 20 : -20, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="min-h-full flex flex-col space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30 mt-12">
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
                      {msg.imageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                          <img src={msg.imageUrl} alt="Generated" className="w-full h-auto max-w-sm" />
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        {msg.isAi && msg.text.startsWith('[System Error]') && (
                          <button
                            onClick={retryLastMessage}
                            disabled={isTyping}
                            className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] uppercase tracking-widest transition-all border border-white/10"
                          >
                            <RefreshCcw size={12} className={isTyping ? 'animate-spin' : ''} />
                            {lang === 'en' ? 'Retry' : 'पुनः प्रयास करें'}
                          </button>
                        )}
                        {msg.isAi && !msg.isImageRequest && msg.text && !msg.text.startsWith('[System') && (
                          <button
                            onClick={() => speak(msg.id, msg.text)}
                            className={`mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all border ${
                              speakingId === msg.id
                                ? 'bg-aura-red/20 border-aura-red/50 text-aura-red'
                                : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                            }`}
                          >
                            {speakingId === msg.id ? (
                              <>
                                <Square size={12} className="fill-current" />
                                {lang === 'en' ? 'Stop' : 'रोकें'}
                              </>
                            ) : (
                              <>
                                <Volume2 size={12} />
                                {lang === 'en' ? 'Speak' : 'सुने'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isGeneratingImage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start mb-6"
                >
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30 flex-shrink-0">
                      <Sparkles size={14} className="text-purple-400 animate-pulse" />
                    </div>
                    <div className="bg-white/5 border border-purple-500/20 rounded-2xl rounded-bl-none p-4 relative min-w-[200px] overflow-hidden">
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      />
                      <div className="flex flex-col gap-2 relative z-10">
                        <div className="h-2 bg-purple-500/30 rounded-full w-3/4" />
                        <div className="h-2 bg-purple-500/30 rounded-full w-1/2" />
                      </div>
                      <p className="text-[10px] text-purple-300/80 tracking-widest uppercase mt-3 relative z-10">
                        {lang === 'en' ? 'Manifesting Vision...' : 'चित्र बन रहा है...'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {isTyping && !isGeneratingImage && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 px-5 py-3 rounded-2xl rounded-bl-none border border-white/10 flex items-center gap-3 w-fit max-w-[80%]">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-aura-red rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] uppercase tracking-widest text-white/50 font-bold">
                      {mode === 'COUNCIL' 
                        ? (lang === 'en' ? 'Council is analyzing...' : 'काउंसिल विश्लेषण कर रही है...')
                        : (lang === 'en' ? `${selectedCharacter} is thinking...` : `${selectedCharacter} सोच रहे हैं...`)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="relative z-20 p-4 bg-black border-t border-white/5">
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 bg-white/5 rounded-2xl border border-white/10 px-4 py-2 focus-within:border-aura-red/50 transition-all"
        >
          <div className="relative flex items-center justify-center mb-1">
            <button
              type="button"
              onClick={() => setShowActionMenu(!showActionMenu)}
              className={`p-2 rounded-full transition-all ${showActionMenu ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
            >
              <Plus size={18} className={`transition-transform duration-300 ${showActionMenu ? 'rotate-45' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showActionMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowActionMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-3 bg-[#111] border border-white/10 rounded-xl p-1.5 flex flex-col gap-1 min-w-[160px] shadow-2xl z-40"
                  >
                    <button
                      type="button"
                      onClick={() => { setInputAction('CHAT'); setShowActionMenu(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium tracking-wider uppercase transition-all ${inputAction === 'CHAT' ? 'bg-aura-red/20 text-aura-red' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                      <MessageSquare size={14} />
                      {lang === 'en' ? 'Chat' : 'चैट'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInputAction('IMAGE'); setShowActionMenu(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium tracking-wider uppercase transition-all ${inputAction === 'IMAGE' ? 'bg-aura-red/20 text-aura-red' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                      <ImageIcon size={14} />
                      {lang === 'en' ? 'Image' : 'चित्र'}
                    </button>
                    {mode === 'MENTOR' && messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { bringToCouncil(); setShowActionMenu(false); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium tracking-wider uppercase transition-all text-aura-red hover:bg-aura-red/10"
                      >
                        <Users size={14} />
                        {lang === 'en' ? 'Escalate' : 'परिषद को सौंपें'}
                      </button>
                    )}
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); window.location.hash = 'focus'; setShowActionMenu(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium tracking-wider uppercase transition-all text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Target size={14} />
                      {lang === 'en' ? 'Focus' : 'ध्यान'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); window.location.hash = 'simulator'; setShowActionMenu(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium tracking-wider uppercase transition-all text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Gamepad2 size={14} />
                      {lang === 'en' ? 'Simulator' : 'सिम्युलेटर'}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
                e.currentTarget.style.height = 'auto';
              }
            }}
            rows={1}
            placeholder={inputAction === 'IMAGE' 
              ? (lang === 'en' ? "Describe the image to generate..." : "बनाने के लिए चित्र का वर्णन करें...")
              : mode === 'COUNCIL' 
              ? (lang === 'en' ? "Message the Council..." : "परिषद को संदेश भेजें...")
              : (lang === 'en' ? `Message ${selectedCharacter}...` : `${selectedCharacter} को संदेश भेजें...`)}
            className="flex-1 bg-transparent border-none py-2 text-sm text-white placeholder:text-white/20 focus:outline-none resize-none overflow-y-auto scrollbar-hide ml-1"
            style={{ minHeight: '40px', maxHeight: '150px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className={`p-2 mb-1 rounded-full text-black disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${inputAction === 'IMAGE' ? 'bg-purple-500' : 'bg-aura-red'}`}
          >
            {inputAction === 'IMAGE' ? <ImageIcon size={18} /> : <Send size={18} />}
          </button>
        </form>
        <div className="h-safe-bottom" /> {/* Handle safe area for mobile */}
      </div>
      </>
      ) : view === 'focus' ? (
        <Focus />
      ) : (
        <Simulator />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && <Settings onClose={closeModals} />}
    </div>
  );
}
