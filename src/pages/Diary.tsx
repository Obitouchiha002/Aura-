import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { Mic, Square, Save, Trash2, Play, Pause } from 'lucide-react';

interface DiaryEntry {
  id: string;
  date: string;
  text: string;
  audioUrl?: string;
}

export default function Diary() {
  const { lang } = useLang();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [auraPoints, setAuraPoints] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('aura_diary');
    const points = localStorage.getItem('aura_points');
    if (saved) setEntries(JSON.parse(saved));
    if (points) setAuraPoints(parseInt(points));
  }, []);

  const saveToLocal = (newEntries: DiaryEntry[], newPoints: number) => {
    localStorage.setItem('aura_diary', JSON.stringify(newEntries));
    localStorage.setItem('aura_points', newPoints.toString());
    setEntries(newEntries);
    setAuraPoints(newPoints);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert(lang === 'en' ? "Microphone access denied." : "माइक्रोफ़ोन की अनुमति नहीं मिली।");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  };

  const handleSave = () => {
    if (!text.trim() && !audioBlob) return;

    let audioUrl = '';
    if (audioBlob) {
      audioUrl = URL.createObjectURL(audioBlob);
    }

    const newEntry: DiaryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'hi-IN'),
      text: text.trim(),
      audioUrl
    };

    const newPoints = auraPoints + 10;
    saveToLocal([newEntry, ...entries], newPoints);
    
    setText('');
    setAudioBlob(null);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const deleteEntry = (id: string) => {
    const filtered = entries.filter(e => e.id !== id);
    saveToLocal(filtered, auraPoints);
  };

  return (
    <div className="min-h-screen bg-transparent pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6"
        >
          <div>
            <h1 className="font-display text-4xl md:text-6xl font-light tracking-tighter mb-4">
              {lang === 'en' ? 'The Vault of Mistakes' : 'गलतियों का वॉल्ट'}
            </h1>
            <p className="text-white/60">
              {lang === 'en' 
                ? 'A king learns from his scars. Document your failures. Forge your power.' 
                : 'एक राजा अपने निशानों से सीखता है। अपनी गलतियां लिखो। अपनी ताकत बढ़ाओ।'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-red-500 mb-1">
              {lang === 'en' ? 'Aura Power Level' : 'आभा शक्ति स्तर'}
            </div>
            <div className="font-display text-4xl text-white glow-text">{auraPoints}</div>
          </div>
        </motion.div>

        <div className="bg-white/[0.02] border border-white/10 p-6 mb-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'en' ? "Confess your weakness today..." : "आज अपनी कमज़ोरी लिखो..."}
            className="w-full h-32 bg-transparent text-white placeholder:text-white/30 resize-none focus:outline-none font-light leading-relaxed"
          />
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <button onClick={startRecording} className="flex items-center gap-2 text-white/50 hover:text-red-500 transition-colors">
                  <Mic size={20} />
                  <span className="text-sm uppercase tracking-widest hidden md:inline">
                    {lang === 'en' ? 'Record' : 'रिकॉर्ड करें'}
                  </span>
                </button>
              ) : (
                <button onClick={stopRecording} className="flex items-center gap-2 text-red-500 animate-pulse">
                  <Square size={20} />
                  <span className="text-sm uppercase tracking-widest hidden md:inline">
                    {lang === 'en' ? 'Stop' : 'रोकें'}
                  </span>
                </button>
              )}
              {audioBlob && <span className="text-xs text-green-500">{lang === 'en' ? 'Audio Ready' : 'ऑडियो तैयार'}</span>}
            </div>
            
            <button 
              onClick={handleSave}
              disabled={!text.trim() && !audioBlob}
              className="flex items-center gap-2 bg-red-500/10 text-red-500 px-6 py-2 hover:bg-red-500 hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-red-500/10 disabled:hover:text-red-500"
            >
              <Save size={18} />
              <span className="text-sm uppercase tracking-widest font-bold">
                {lang === 'en' ? 'Seal' : 'सहेजें'}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {entries.map((entry) => (
            <motion.div 
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 border-l-2 border-white/10 hover:border-red-500 bg-white/[0.01] transition-colors group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs text-white/40 font-mono">{entry.date}</div>
                <button onClick={() => deleteEntry(entry.id)} className="text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
              {entry.text && <p className="text-white/80 font-light leading-relaxed mb-4 whitespace-pre-wrap">{entry.text}</p>}
              {entry.audioUrl && (
                <audio controls src={entry.audioUrl} className="h-8 w-full max-w-md opacity-70 hover:opacity-100 transition-opacity" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
