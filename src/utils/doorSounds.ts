// Synthesized SFX for the match-found elevator doors (Web Audio, no asset files).
// Every sound goes through one compressor so stacked layers never clip.
import { getAudioContext } from '@/utils/matchSounds';

const MASTER_VOLUME = 0.7;

let master: { ctx: AudioContext; input: GainNode } | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getMaster() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!master || master.ctx !== ctx) {
    const input = ctx.createGain();
    input.gain.value = MASTER_VOLUME;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    input.connect(comp);
    comp.connect(ctx.destination);
    master = { ctx, input };
    noiseBuffer = null;
  }
  return master;
}

function getNoise(ctx: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Runs `build` with a start time, resuming a suspended context first. */
function play(build: (ctx: AudioContext, out: AudioNode, t: number) => void, delaySec = 0) {
  const m = getMaster();
  if (!m) return;
  const go = () => {
    try {
      build(m.ctx, m.input, m.ctx.currentTime + 0.01 + delaySec);
    } catch {
      // Audio is decoration; never let it break the transition.
    }
  };
  if (m.ctx.state === 'suspended') void m.ctx.resume().then(go).catch(() => {});
  else go();
}

function envelope(ctx: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function noiseBurst(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  o: { dur: number; peak: number; type: BiquadFilterType; freq: number; freqTo?: number; q?: number; attack?: number }
) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.dur);
  const g = envelope(ctx, t, o.peak, o.attack ?? 0.005, o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + (o.attack ?? 0.005) + o.dur + 0.05);
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  o: { freq: number; freqTo?: number; dur: number; peak: number; type?: OscillatorType; attack?: number; lowpass?: number }
) {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.dur);
  const g = envelope(ctx, t, o.peak, o.attack ?? 0.004, o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    node = osc.connect(f);
  }
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + (o.attack ?? 0.004) + o.dur + 0.05);
}

/** Motor whir + rushing air while the doors slide shut. */
export function playDoorsClosing(durationSec: number) {
  play((ctx, out, t) => {
    tone(ctx, out, t, { freq: 55, freqTo: 95, dur: durationSec, peak: 0.07, type: 'sawtooth', attack: 0.08, lowpass: 320 });
    noiseBurst(ctx, out, t, { dur: durationSec, peak: 0.16, type: 'bandpass', freq: 350, freqTo: 1600, q: 0.7, attack: durationSec * 0.8 });
  });
}

/** Heavy metal doors meeting: low thump, short crack, ringing clang. */
export function playDoorsImpact() {
  play((ctx, out, t) => {
    tone(ctx, out, t, { freq: 120, freqTo: 38, dur: 0.38, peak: 0.85 });
    noiseBurst(ctx, out, t, { dur: 0.07, peak: 0.35, type: 'highpass', freq: 1400 });
    noiseBurst(ctx, out, t, { dur: 0.25, peak: 0.25, type: 'lowpass', freq: 600, freqTo: 120 });
    // Inharmonic partials read as a metal panel ringing out.
    const partials: Array<[number, number, number]> = [
      [182, 0.09, 0.9],
      [497, 0.06, 0.7],
      [503, 0.05, 0.7],
      [971, 0.035, 0.5],
      [1613, 0.02, 0.35],
      [2389, 0.012, 0.25],
    ];
    for (const [freq, peak, dur] of partials) tone(ctx, out, t, { freq, dur, peak, type: 'triangle', attack: 0.002 });
  });
}

/** Two quick mechanical clicks: the lock bolts engaging. */
export function playDoorsLatch(delaySec = 0.14) {
  play((ctx, out, t) => {
    for (const dt of [0, 0.075]) {
      noiseBurst(ctx, out, t + dt, { dur: 0.018, peak: 0.3, type: 'bandpass', freq: 2800, q: 4, attack: 0.001 });
      tone(ctx, out, t + dt, { freq: 900, freqTo: 600, dur: 0.03, peak: 0.08, type: 'square', attack: 0.001, lowpass: 2500 });
    }
  }, delaySec);
}

/** Short low "VS" sting under the player cards. */
export function playVersusSting() {
  play((ctx, out, t) => {
    tone(ctx, out, t, { freq: 55, dur: 1.1, peak: 0.22, attack: 0.01 });
    for (const [freq, detune] of [
      [110, 0],
      [164.8, 0],
      [220, 0],
      [110, 7],
    ] as const) {
      const f = freq * Math.pow(2, detune / 1200);
      tone(ctx, out, t, { freq: f, dur: 0.9, peak: 0.045, type: 'sawtooth', attack: 0.015, lowpass: 900 });
    }
    noiseBurst(ctx, out, t, { dur: 0.8, peak: 0.05, type: 'highpass', freq: 5000, attack: 0.3 });
  });
}

/** Bolts release with a clunk, then the motor pulls the doors apart. */
export function playDoorsOpening(slideDelaySec: number, slideSec: number) {
  play((ctx, out, t) => {
    tone(ctx, out, t, { freq: 90, freqTo: 50, dur: 0.16, peak: 0.35 });
    noiseBurst(ctx, out, t, { dur: 0.03, peak: 0.25, type: 'bandpass', freq: 2200, q: 3, attack: 0.001 });
    const s = t + slideDelaySec;
    noiseBurst(ctx, out, s, { dur: slideSec, peak: 0.14, type: 'bandpass', freq: 1500, freqTo: 300, q: 0.7, attack: 0.08 });
    tone(ctx, out, s, { freq: 95, freqTo: 60, dur: slideSec, peak: 0.06, type: 'sawtooth', attack: 0.05, lowpass: 300 });
  });
}
