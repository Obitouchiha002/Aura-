import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { generateTTS } from '../services/geminiService';

export function useTTS() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const { ttsVoiceURI, userApiKey } = useSettings();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentIdRef = useRef<string | null>(null);

  // Clean up
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }
      if (audioContextRef.current) {
         audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    setSpeakingId(null);
    currentIdRef.current = null;
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    // Toggle off if already playing the same ID
    if (currentIdRef.current === id) {
      stop();
      return;
    }

    stop();
    
    // Strip markdown characters and character name brackets for cleaner reading
    let cleanText = text.replace(/[*_#`~\[\]]/g, '');
    cleanText = cleanText.replace(/^[A-Za-z\s]+:\s*/, ''); // Remove leading "Name: " sometimes present
    cleanText = cleanText.trim();
    
    if (!cleanText) return;

    setSpeakingId(id);
    currentIdRef.current = id;
    
    // Default to 'Charon' (deep resonant male voice) if not specified
    const voiceName = ttsVoiceURI || 'Charon';
    
    const base64Audio = await generateTTS(cleanText, voiceName, userApiKey);
    
    // Check if user clicked stop or another ID while fetching
    if (currentIdRef.current !== id) {
       return;
    }

    if (!base64Audio) {
      setSpeakingId(null);
      currentIdRef.current = null;
      console.error("Failed to generate TTS audio");
      alert("Failed to generate audio. Please try again.");
      return;
    }

    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      const sampleRate = 24000;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
      } else if (audioContextRef.current.sampleRate !== sampleRate) {
        audioContextRef.current.close();
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
      }
      
      const audioContext = audioContextRef.current;
      const buffer = audioContext.createBuffer(1, float32Array.length, sampleRate);
      buffer.getChannelData(0).set(float32Array);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
         if (currentIdRef.current === id) {
            setSpeakingId(null);
            currentIdRef.current = null;
         }
      };
      
      sourceRef.current = source;
      source.start();
      
    } catch (error) {
      console.error("Audio playback error:", error);
      if (currentIdRef.current === id) {
        setSpeakingId(null);
        currentIdRef.current = null;
      }
    }

  }, [stop, ttsVoiceURI, userApiKey]);

  return { speakingId, speak, stop };
}
