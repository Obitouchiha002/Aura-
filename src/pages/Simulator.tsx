import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getSimulatorNextScenario, evaluateSimulatorAction, getSimulatorReport } from '../services/geminiService';
import { useSettings } from '../context/SettingsContext';
import { useLang } from '../context/LanguageContext';
import { Send, Bot, RefreshCcw, Trash2, Settings as SettingsIcon, Activity, X, Brain, ArrowLeft } from 'lucide-react';

type SimState = 'START' | 'SCENARIO' | 'EVALUATING' | 'RESULT' | 'BREAK';

export default function Simulator() {
  const { lang } = useLang();
  const { hapticFeedback, userApiKey, language } = useSettings();

  const [simState, setSimState] = useState<SimState>('START');
  const [level, setLevel] = useState(1);
  const [scenarioText, setScenarioText] = useState('');
  const [evaluationText, setEvaluationText] = useState('');
  const [history, setHistory] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loadingText, setLoadingText] = useState('');

  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const triggerHaptic = () => {
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Load state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_simulator_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSimState(parsed.simState || 'START');
        setLevel(parsed.level || 1);
        setScenarioText(parsed.scenarioText || '');
        setEvaluationText(parsed.evaluationText || '');
        setHistory(parsed.history || []);
      }
    } catch (e) {}
  }, []);

  // Save state
  useEffect(() => {
    try {
      localStorage.setItem('aura_simulator_state', JSON.stringify({
        simState, level, scenarioText, evaluationText, history
      }));
    } catch (e) {}
  }, [simState, level, scenarioText, evaluationText, history]);

  const clearSimulator = () => {
    triggerHaptic();
    setSimState('START');
    setLevel(1);
    setScenarioText('');
    setEvaluationText('');
    setHistory([]);
    setInput('');
    localStorage.removeItem('aura_simulator_state');
  };

  const handleStart = async () => {
    triggerHaptic();
    setSimState('EVALUATING');
    setLoadingText(lang === 'en' ? 'Generating Scenario...' : 'Scenario Generate ho raha hai...');
    
    const res = await getSimulatorNextScenario(1, [], userApiKey, language);
    setScenarioText(res);
    setHistory([
      { role: 'user', text: 'Generate Scenario Level 1' },
      { role: 'model', text: res }
    ]);
    setSimState('SCENARIO');
  };

  const handleSubmitAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userAction = input.trim();
    if (!userAction) return;

    triggerHaptic();
    setSimState('EVALUATING');
    setLoadingText(lang === 'en' ? 'Calculating your result...' : 'Result calculate ho raha hai...');
    
    const res = await evaluateSimulatorAction(userAction, history, userApiKey, language);
    setEvaluationText(res);
    setHistory(prev => [
      ...prev,
      { role: 'user', text: `My action: ${userAction}` },
      { role: 'model', text: res }
    ]);
    setSimState('RESULT');
    setInput('');
  };

  const handleContinue = async () => {
    triggerHaptic();
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setSimState('EVALUATING');
    setLoadingText(lang === 'en' ? 'Generating Next Scenario...' : 'Next Scenario Generate ho raha hai...');
    
    const res = await getSimulatorNextScenario(nextLevel, history, userApiKey, language);
    setScenarioText(res);
    setHistory(prev => [
      ...prev,
      { role: 'user', text: `Generate Scenario Level ${nextLevel}` },
      { role: 'model', text: res }
    ]);
    setSimState('SCENARIO');
  };

  const handleBreak = () => {
    triggerHaptic();
    setSimState('BREAK');
  };

  const handleResume = () => {
    triggerHaptic();
    handleContinue();
  };

  const handleGenerateReport = async () => {
    triggerHaptic();
    setShowReport(true);
    if (reportData) return;

    setIsGeneratingReport(true);
    try {
      const data = await getSimulatorReport(history, userApiKey, language);
      setReportData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0A0A0A]">
      {/* Header */}
      <div className="w-full flex justify-between items-center max-w-3xl mx-auto px-4 py-3 relative z-20 border-b border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => { triggerHaptic(); window.location.hash = 'chat'; }}
            className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10 bg-white/5 border border-white/10"
            title={lang === 'en' ? 'Back to Chat' : 'चैट पर वापस जाएं'}
          >
            <ArrowLeft size={18} />
          </button>
          {history.length > 0 && (
            <button
              onClick={handleGenerateReport}
              className="p-2 text-aura-red hover:text-white transition-colors rounded-full hover:bg-white/10 flex items-center gap-2"
              title={lang === 'en' ? 'IQ Report' : 'IQ रिपोर्ट'}
            >
              <Activity size={18} />
              <span className="text-[10px] uppercase tracking-widest hidden md:inline font-mono">Report</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/10">
          <span className="px-4 py-2 rounded-full text-[10px] md:text-xs tracking-[0.2em] uppercase bg-aura-red text-black font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)] font-mono">
            Shadow Mind
          </span>
        </div>
        
        <div className="flex items-center justify-end gap-2 flex-1">
          {history.length > 0 && (
            <button
              onClick={clearSimulator}
              className="p-2 text-white/40 hover:text-aura-red transition-colors rounded-full hover:bg-white/10"
              title={lang === 'en' ? 'Restart Simulator' : 'सिम्युलेटर रीस्टार्ट करें'}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative z-10 scroll-smooth scrollbar-hide flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* START STATE */}
          {simState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8 p-6"
            >
              <div className="w-24 h-24 rounded-full border border-aura-red/50 flex items-center justify-center bg-aura-red/10 shadow-[0_0_40px_rgba(239,68,68,0.2)] relative">
                <div className="absolute inset-0 rounded-full border border-aura-red/30 animate-ping" style={{ animationDuration: '3s' }} />
                <Brain size={48} className="text-aura-red" />
              </div>
              <div className="space-y-4 max-w-md px-4">
                <h3 className="font-display text-lg md:text-xl tracking-[0.3em] uppercase text-white">
                  System Initialization
                </h3>
                <p className="text-xs text-white/50 tracking-wider leading-relaxed font-mono">
                  {lang === 'en' 
                    ? 'A psychological and strategic simulation designed to test your reasoning, emotional control, and practical legal knowledge.' 
                    : 'आपकी तर्क क्षमता, मनोवैज्ञानिक नियंत्रण और व्यावहारिक कानूनी ज्ञान का परीक्षण करने के लिए एक सिमुलेशन।'}
                </p>
              </div>
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-aura-red text-black font-bold text-xs tracking-[0.2em] uppercase rounded-none hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-aura-red"
              >
                {lang === 'en' ? 'Initialize Simulation' : 'सिमुलेशन शुरू करें'}
              </button>
            </motion.div>
          )}

          {/* EVALUATING STATE */}
          {simState === 'EVALUATING' && (
            <motion.div 
              key="evaluating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8 p-6"
            >
              <div className="relative w-32 h-32 flex items-center justify-center">
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }} 
                  className="absolute inset-0 rounded-full border-t-2 border-aura-red border-r-2 border-transparent" 
                />
                <motion.div 
                  animate={{ rotate: -360 }} 
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }} 
                  className="absolute inset-4 rounded-full border-b-2 border-white/50 border-l-2 border-transparent" 
                />
                <Brain className="text-aura-red animate-pulse" size={32} />
              </div>
              <p className="text-aura-red uppercase tracking-[0.3em] text-xs font-bold animate-pulse font-mono text-center">
                {loadingText}
              </p>
            </motion.div>
          )}

          {/* SCENARIO STATE */}
          {simState === 'SCENARIO' && (
            <motion.div 
              key="scenario"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full"
            >
              <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <span className="text-aura-red font-bold uppercase tracking-widest text-xs font-mono">
                  Level {level}
                </span>
                <span className="text-white/30 uppercase tracking-widest text-[10px] font-mono">
                  Awaiting Input
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-8 text-white/90 leading-relaxed text-sm md:text-base whitespace-pre-wrap font-mono scrollbar-hide">
                {scenarioText}
              </div>
              
              <div className="bg-black p-4 rounded-none border border-white/20 focus-within:border-aura-red/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
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
                      handleSubmitAction(e);
                    }
                  }}
                  rows={2}
                  placeholder={lang === 'en' ? "What is your exact next move?" : "आपका अगला कदम क्या होगा?"}
                  className="w-full bg-transparent border-none py-2 text-sm text-white placeholder:text-white/20 focus:outline-none resize-none overflow-y-auto scrollbar-hide font-mono"
                  style={{ minHeight: '60px', maxHeight: '150px' }}
                />
                <div className="flex justify-end mt-4">
                  <button 
                    onClick={handleSubmitAction}
                    disabled={!input.trim()}
                    className="bg-aura-red text-black px-6 py-2 rounded-none font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-30 disabled:hover:scale-100"
                  >
                    Execute
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* RESULT STATE */}
          {simState === 'RESULT' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full"
            >
              <h2 className="text-aura-red font-bold uppercase tracking-widest text-sm mb-6 font-mono border-b border-white/10 pb-4">
                Evaluation Result
              </h2>
              
              <div className="flex-1 overflow-y-auto mb-8 text-white/90 leading-relaxed text-sm md:text-base whitespace-pre-wrap font-mono scrollbar-hide">
                {evaluationText}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                <button 
                  onClick={handleContinue} 
                  className="flex-1 bg-aura-red text-black py-4 rounded-none font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Continue to Level {level + 1}
                </button>
                <button 
                  onClick={handleBreak} 
                  className="flex-1 bg-transparent text-white/70 py-4 rounded-none font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors border border-white/20"
                >
                  Take a Break
                </button>
              </div>
            </motion.div>
          )}

          {/* BREAK STATE */}
          {simState === 'BREAK' && (
            <motion.div 
              key="break"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <h2 className="text-2xl md:text-3xl font-display text-white mb-6 tracking-widest">
                {lang === 'en' ? "I will wait for you." : "Main tumhara intezaar karunga."}
              </h2>
              <p className="text-white/50 text-xs md:text-sm mb-12 font-mono uppercase tracking-widest">
                {lang === 'en' ? "Take your time. The shadows will be here when you return." : "Aaram karo. Jab taiyaar ho, wapas aana."}
              </p>
              <button 
                onClick={handleResume} 
                className="bg-aura-red text-black px-10 py-4 rounded-none font-bold text-xs uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                Resume Training
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* IQ Report Modal */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-none p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto scrollbar-hide relative shadow-[0_0_50px_rgba(239,68,68,0.1)]"
            >
              <button
                onClick={() => setShowReport(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full border border-aura-red/50 flex items-center justify-center bg-aura-red/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <Brain size={32} className="text-aura-red" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-display tracking-[0.2em] uppercase text-white">
                    Practical IQ Report
                  </h2>
                  <p className="text-[10px] text-white/50 tracking-wider font-mono uppercase">
                    Based on your simulation decisions
                  </p>
                </div>

                {isGeneratingReport ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <div className="flex gap-2">
                      <span className="w-2 h-2 bg-aura-red rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-aura-red rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-aura-red rounded-full animate-bounce" />
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Analyzing your mind...</p>
                  </div>
                ) : reportData ? (
                  <div className="w-full space-y-8 text-left font-mono">
                    {/* Score */}
                    <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-none border border-white/10">
                      <span className="text-5xl font-display text-aura-red mb-2">{reportData.practicalIQ}</span>
                      <span className="text-xs uppercase tracking-widest text-white/70 text-center">{reportData.title}</span>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-green-400 border-b border-green-400/20 pb-2">Strengths</h4>
                        <ul className="space-y-2">
                          {reportData.strengths?.map((s: string, i: number) => (
                            <li key={i} className="text-[10px] md:text-xs text-white/70 flex items-start gap-2 leading-relaxed">
                              <span className="text-green-400 mt-0.5">+</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-red-400 border-b border-red-400/20 pb-2">Weaknesses</h4>
                        <ul className="space-y-2">
                          {reportData.weaknesses?.map((w: string, i: number) => (
                            <li key={i} className="text-[10px] md:text-xs text-white/70 flex items-start gap-2 leading-relaxed">
                              <span className="text-red-400 mt-0.5">-</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Comparisons */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/50 text-center border-b border-white/10 pb-2">Where You Stand</h4>
                      <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 scrollbar-hide">
                        {reportData.comparisons?.map((comp: any, i: number) => (
                          <div 
                            key={i} 
                            className={`flex items-center justify-between p-3 rounded-none border ${
                              comp.name === 'You' 
                                ? 'bg-aura-red/10 border-aura-red/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                                : 'bg-white/5 border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold uppercase tracking-wider ${comp.name === 'You' ? 'text-aura-red' : 'text-white/90'}`}>
                                {comp.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[9px] uppercase tracking-widest text-white/40 hidden sm:inline">{comp.status}</span>
                              <span className="text-xs font-bold text-white/70 w-8 text-right">{comp.iq}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setReportData(null);
                        handleGenerateReport();
                      }}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-none text-[10px] uppercase tracking-widest text-white/70 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={14} />
                      Recalculate
                    </button>
                  </div>
                ) : (
                  <div className="py-8 text-center text-white/50 text-xs font-mono uppercase tracking-widest">
                    Failed to generate report.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
