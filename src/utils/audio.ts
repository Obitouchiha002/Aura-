export class AudioEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: { osc?: OscillatorNode, gain?: GainNode, lfo?: OscillatorNode, interval?: number } = {};

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(type: 'drone' | 'heartbeat' | 'scifi') {
    this.init();
    if (!this.ctx) return;
    this.stop();

    if (type === 'drone') {
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
      gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      lfo.start();

      this.activeNodes = { osc, gain, lfo };
    } else if (type === 'scifi') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, this.ctx.currentTime);

      lfo.type = 'square';
      lfo.frequency.setValueAtTime(2, this.ctx.currentTime);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(10, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      lfo.start();

      this.activeNodes = { osc, gain, lfo };
    } else if (type === 'heartbeat') {
      const playBeat = () => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(40, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
        
        setTimeout(() => {
          if (!this.ctx) return;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(45, this.ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
          
          gain2.gain.setValueAtTime(0.3, this.ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
          
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          
          osc2.start();
          osc2.stop(this.ctx.currentTime + 0.5);
        }, 200);
      };
      
      playBeat();
      const interval = window.setInterval(playBeat, 1000);
      this.activeNodes = { interval };
    }
  }

  stop() {
    if (this.activeNodes.gain && this.ctx) {
      this.activeNodes.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      const { osc, lfo } = this.activeNodes;
      setTimeout(() => {
        try {
          osc?.stop();
          lfo?.stop();
          osc?.disconnect();
          lfo?.disconnect();
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
