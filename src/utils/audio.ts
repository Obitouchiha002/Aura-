export class AudioEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: { osc?: any, gain?: GainNode, lfo?: any, interval?: number, source?: AudioBufferSourceNode } = {};
  private currentVolume: number = 0.5;
  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      const handleStop = () => {
        if (document.visibilityState === 'hidden') {
          this.stop();
        }
      };
      document.addEventListener('visibilitychange', handleStop);
      window.addEventListener('pagehide', () => this.stop());
      window.addEventListener('beforeunload', () => this.stop());
    }
  }

  private init() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn("AudioContext not supported or blocked", e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {}
    }
  }

  setVolume(volume: number) {
    this.currentVolume = volume;
    if (this.activeNodes.gain && this.ctx) {
      // Scale the volume down slightly for synthetic sounds so they aren't deafening
      this.activeNodes.gain.gain.setTargetAtTime(volume * 0.8, this.ctx.currentTime, 0.1);
    }
  }

  play(type: 'none' | 'ambient' | 'lofi' | 'nature' | 'classical' | 'focus' | 'custom', customUrl?: string | null) {
    this.init();
    this.stop();

    if (!this.ctx) return;

    if (type === 'custom' && customUrl) {
      (async () => {
        try {
          let buffer = this.decodedBuffers.get(customUrl);
          if (!buffer) {
            const response = await fetch(customUrl);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await this.ctx!.decodeAudioData(arrayBuffer);
            this.decodedBuffers.set(customUrl, buffer);
          }

          const source = this.ctx!.createBufferSource();
          source.buffer = buffer;
          source.loop = true;

          const gain = this.ctx!.createGain();
          gain.gain.setValueAtTime(0, this.ctx!.currentTime);
          gain.gain.linearRampToValueAtTime(this.currentVolume, this.ctx!.currentTime + 1);

          source.connect(gain);
          gain.connect(this.ctx!.destination);

          source.start();
          this.activeNodes = { source, gain };
        } catch (e) {
          console.error("Custom audio play failed via Web Audio API", e);
        }
      })();
      return;
    }

    if (type === 'ambient') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(2, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.currentVolume * 0.8, this.ctx.currentTime + 2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      lfo.start();

      this.activeNodes = { osc, gain, lfo };
    } else if (type === 'lofi') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, this.ctx.currentTime);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.currentVolume * 0.3, this.ctx.currentTime + 2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      this.activeNodes = { osc, gain };
    } else if (type === 'nature') {
      // White noise for nature/wind
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.currentVolume * 0.05, this.ctx.currentTime + 2);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noise.start();
      this.activeNodes = { source: noise, gain };
    } else if (type === 'classical' || type === 'focus') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'focus' ? 174 : 220, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.currentVolume * 0.2, this.ctx.currentTime + 2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      this.activeNodes = { osc, gain };
    }
  }

  beep() {
    this.init();
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.currentVolume, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  stop() {
    if (this.activeNodes.gain && this.ctx) {
      this.activeNodes.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      const { osc, lfo, source } = this.activeNodes;
      setTimeout(() => {
        try {
          osc?.stop();
          lfo?.stop();
          source?.stop();
          osc?.disconnect();
          lfo?.disconnect();
          source?.disconnect();
        } catch (e) {}
      }, 1000);
    }
    if (this.activeNodes.interval) {
      clearInterval(this.activeNodes.interval);
    }
    this.activeNodes = {};
  }
}

export const globalAudio = new AudioEngine();
