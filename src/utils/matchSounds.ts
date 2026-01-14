type Tone = {
  freq: number;
  durationMs: number;
  volume?: number;
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
  slideTo?: number;
};

const DEFAULT_ATTACK_MS = 12;
const DEFAULT_RELEASE_MS = 140;
const DEFAULT_VOLUME = 0.16;
const DEFAULT_TYPE: OscillatorType = 'triangle';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioCtor();
  }
  return audioContext;
}

function scheduleTone(ctx: AudioContext, tone: Tone, startAt: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const volume = tone.volume ?? DEFAULT_VOLUME;
  const attack = (tone.attackMs ?? DEFAULT_ATTACK_MS) / 1000;
  const release = (tone.releaseMs ?? DEFAULT_RELEASE_MS) / 1000;
  const duration = tone.durationMs / 1000;
  const endAt = startAt + duration;

  osc.type = tone.type ?? DEFAULT_TYPE;
  osc.frequency.setValueAtTime(tone.freq, startAt);
  if (tone.slideTo) {
    osc.frequency.linearRampToValueAtTime(tone.slideTo, endAt);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt + release);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(endAt + release + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

function playSequence(tones: Tone[], gapMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = () => {
    let cursor = ctx.currentTime + 0.02;
    for (const tone of tones) {
      scheduleTone(ctx, tone, cursor);
      cursor += (tone.durationMs + gapMs) / 1000;
    }
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(start).catch(() => {});
  } else {
    start();
  }
}

export function playMatchStartSound() {
  playSequence(
    [
      { freq: 520, durationMs: 260, volume: 0.14, type: 'sine' },
      { freq: 680, durationMs: 260, volume: 0.14, type: 'sine' },
      { freq: 840, durationMs: 260, volume: 0.15, type: 'sine' },
    ],
    60
  );
}

export function playMatchFoundSound() {
  playSequence(
    [
      { freq: 480, durationMs: 200, volume: 0.17 },
      { freq: 640, durationMs: 220, volume: 0.18 },
      { freq: 820, durationMs: 260, volume: 0.2 },
      { freq: 1020, durationMs: 450, volume: 0.22, type: 'sawtooth' },
    ],
    40
  );
}
