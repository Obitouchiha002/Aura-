import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { generateTTS } from '../services/geminiService';

export function useTTS() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const { ttsVoiceURI, userApiKey } = useSettings();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const currentRequestRef = useRef<{ id: string, cancel: () => void } | null>(null);

  // Clean up
  useEffect(() => {
    return () => {
      currentRequestRef.current?.cancel();
      activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stop = useCallback(() => {
    currentRequestRef.current?.cancel();
    currentRequestRef.current = null;
    activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
    activeSourcesRef.current = [];
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
       audioContextRef.current.close().catch(() => {});
       audioContextRef.current = null;
    }
    setSpeakingId(null);
    currentIdRef.current = null;
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    // If it's the exact same message, toggle Pause / Resume
    if (currentIdRef.current === id && audioContextRef.current) {
        if (speakingId === id) {
            // Playing -> Pause
            audioContextRef.current.suspend();
            setSpeakingId(null);
        } else {
            // Paused -> Resume
            audioContextRef.current.resume();
            setSpeakingId(id);
        }
        return;
    }

    // Otherwise, it's a new message. Stop everything.
    stop();
    
    let cleanText = text.replace(/[*_#`~\[\]]/g, '');
    cleanText = cleanText.replace(/^[A-Za-z\s]+:\s*/, ''); 
    cleanText = cleanText.trim();
    if (!cleanText) return;

    setSpeakingId(id);
    currentIdRef.current = id;
    
    // Chunking text: we increase chunk size to 1000 to prevent Gemini API Rate limits (15 RPM).
    // This ensures that almost any standard message only takes 1 single API request.
    const rawChunks = cleanText.match(/[^.!?\n।]+[.!?\n।]*/g)?.map(s => s.trim()).filter(s => s.length > 0) || [cleanText];
    const chunks: string[] = [];
    let temp = "";
    for (const c of rawChunks) {
      if (temp.length + c.length < 1000) {
        temp += (temp ? " " : "") + c;
      } else {
        if (temp) chunks.push(temp);
        temp = c;
      }
    }
    if (temp) chunks.push(temp);

    let isCancelled = false;
    currentRequestRef.current = { id, cancel: () => isCancelled = true };
    const voiceName = ttsVoiceURI || 'Charon';

    const playNativeBrowserTTS = (fullText: string) => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.lang = fullText.match(/[\u0900-\u097F]/) ? 'hi-IN' : 'en-IN';
        
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.includes('hi') || v.lang.includes('en-IN')) || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;
        
        utterance.rate = 0.95;
        utterance.pitch = 0.9;
        
        utterance.onend = () => {
            if (currentIdRef.current === id) {
               setSpeakingId(null);
               currentIdRef.current = null;
            }
        };
        window.speechSynthesis.speak(utterance);
    };

    (async () => {
       try {
           let nextStartTime = 0;
           let hitLimit = false;

           for (let i = 0; i < chunks.length; i++) {
               if (isCancelled) break;
               
               const chunk = chunks[i];
               const base64Audio = await generateTTS(chunk, voiceName, userApiKey);
               
               if (isCancelled) break;
               if (!base64Audio) {
                  // If we hit an API limit/error on the very first chunk, fallback immediately
                  hitLimit = true;
                  break;
               }

               // Decode audio instantly
               const binaryString = window.atob(base64Audio);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let j = 0; j < len; j++) bytes[j] = binaryString.charCodeAt(j);
               
               const int16Array = new Int16Array(bytes.buffer);
               const float32Array = new Float32Array(int16Array.length);
               for (let j = 0; j < int16Array.length; j++) float32Array[j] = int16Array[j] / 32768.0;
               
               const sampleRate = 24000;
               if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                 audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
               } else if (audioContextRef.current.sampleRate !== sampleRate) {
                 audioContextRef.current.close().catch(()=>{});
                 audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
               }
               
               const ctx = audioContextRef.current;
               const buffer = ctx.createBuffer(1, float32Array.length, sampleRate);
               buffer.getChannelData(0).set(float32Array);
               
               const source = ctx.createBufferSource();
               source.buffer = buffer;
               source.connect(ctx.destination);
               
               if (nextStartTime < ctx.currentTime) {
                   nextStartTime = ctx.currentTime;
               }
               
               source.start(nextStartTime);
               nextStartTime += buffer.duration;
               activeSourcesRef.current.push(source);
               
               const isLastChunk = i === chunks.length - 1;
               source.onended = () => {
                   activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                   // If this was the last chunk and we are done scheduling, reset UI state
                   if (isLastChunk && activeSourcesRef.current.length === 0 && currentIdRef.current === id && !hitLimit) {
                       setSpeakingId(null);
                       currentIdRef.current = null;
                   }
               };
           }
           
           if (hitLimit && !isCancelled) {
               console.warn("Gemini TTS limit or generation failed. Falling back to native browser TTS.");
               // Stop any active gemini audio before falling back
               activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
               activeSourcesRef.current = [];
               playNativeBrowserTTS(cleanText); // Fallback reads the whole text cleanly using browser native
           }
       } catch (error) {
           console.error("Audio generation/playback queue error:", error);
           if (currentIdRef.current === id) {
               setSpeakingId(null);
               currentIdRef.current = null;
           }
       }
    })();

  }, [stop, ttsVoiceURI, userApiKey, speakingId]);

  return { speakingId, speak, stop };
}
