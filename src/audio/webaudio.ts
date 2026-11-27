/**
 * Web Audio plumbing shared by the preview, recording and export screens.
 *
 * Everything lives on one AudioContext per page (iOS caps the number of
 * contexts), and every MR / vocal goes through the same mix graph so the
 * Vocal·MR·Echo·Reverb sliders can move the sound while it is playing.
 */
import { TakeSettings } from '../types';
import { clamp } from '../utils/format';

type AnyAudioContext = any;

let sharedContext: AnyAudioContext | null = null;

export function isWebAudioSupported() {
  const g = globalThis as unknown as Record<string, any>;
  return typeof (g.AudioContext ?? g.webkitAudioContext) === 'function';
}

/** One context for the whole app; browsers start it suspended. */
export function getAudioContext(): AnyAudioContext | null {
  if (sharedContext) return sharedContext;
  const g = globalThis as unknown as Record<string, any>;
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (typeof Ctor !== 'function') return null;
  try {
    sharedContext = new Ctor();
  } catch {
    return null;
  }
  return sharedContext;
}

export async function resumeAudio(ctx: AnyAudioContext | null) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch {
    // autoplay policy: the next user gesture will try again
  }
}

const bufferCache = new Map<string, Promise<any>>();

/** Decode a Blob URL (uploaded MR / recorded take) once and reuse it. */
export function loadAudioBuffer(ctx: AnyAudioContext, url: string): Promise<any | null> {
  const cacheKey = url;
  const cached = bufferCache.get(cacheKey);
  if (cached) return cached;
  const task = (async () => {
    try {
      const res = await fetch(url);
      const bytes = await res.arrayBuffer();
      return await ctx.decodeAudioData(bytes);
    } catch {
      return null;
    }
  })();
  bufferCache.set(cacheKey, task);
  return task;
}

export function forgetBuffer(url: string) {
  bufferCache.delete(url);
}

/** Stereo decaying-noise impulse response for the ConvolverNode. */
export function createImpulseResponse(ctx: AnyAudioContext, seconds = 2.2, decay = 2.8) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  const preDelay = Math.floor(rate * 0.012);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const fade = i < preDelay ? i / preDelay : 1;
      const tail = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * tail * fade;
    }
  }
  return buffer;
}

export interface MixGraph {
  ctx: AnyAudioContext;
  vocalIn: any;
  mrIn: any;
  delay: any;
  set: (settings: TakeSettings) => void;
  /** add another output (e.g. the MediaStreamDestination used for export) */
  connectOutput: (node: any) => void;
  dispose: () => void;
}

const dbCurve = (percent: number) => {
  // 0..100 → 0..1.15 with a gentle curve so small slider moves are audible
  const norm = clamp(percent, 0, 100) / 100;
  return Math.pow(norm, 0.85) * 1.15;
};

/**
 * vocalIn ─┬─> (dry) ─────────────┐
 *          ├─> delay ─(feedback)┐ │
 *          │     └─> echoWet ───┼─┤
 *          └─> convolver ─> revWet ┤
 * mrIn ──────────────────────────> ┴─> master ─> outputs
 */
export function createMixGraph(
  ctx: AnyAudioContext,
  outputs: any[] = [ctx.destination],
): MixGraph {
  const master = ctx.createGain();
  master.gain.value = 1;

  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(master);

  const vocalIn = ctx.createGain();
  vocalIn.gain.value = 0.9;
  vocalIn.connect(bus);

  const mrIn = ctx.createGain();
  mrIn.gain.value = 0.7;
  mrIn.connect(bus);

  // echo: delay line with feedback, returned wet only
  const delay = ctx.createDelay(1.2);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.1;
  const echoWet = ctx.createGain();
  echoWet.gain.value = 0.2;
  vocalIn.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(echoWet);
  echoWet.connect(bus);

  // reverb: generated impulse response, wet only
  const convolver = ctx.createConvolver();
  try {
    convolver.buffer = createImpulseResponse(ctx);
  } catch {
    // ConvolverNode may be unavailable: keep a dry chain
  }
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0.2;
  vocalIn.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(bus);

  const connectOutput = (node: any) => {
    try {
      master.connect(node);
    } catch {
      // already connected
    }
  };
  outputs.forEach(connectOutput);

  const set = (settings: TakeSettings) => {
    const now = ctx.currentTime;
    const ramp = 0.03;
    vocalIn.gain.setTargetAtTime(dbCurve(settings.vocal), now, ramp);
    mrIn.gain.setTargetAtTime(dbCurve(settings.mr), now, ramp);
    echoWet.gain.setTargetAtTime((clamp(settings.echo, 0, 100) / 100) * 0.85, now, ramp);
    feedback.gain.setTargetAtTime((clamp(settings.echo, 0, 100) / 100) * 0.42, now, ramp);
    reverbWet.gain.setTargetAtTime((clamp(settings.reverb, 0, 100) / 100) * 0.95, now, ramp);
  };

  set({ vocal: 80, mr: 65, echo: 28, reverb: 34, syncMs: 0 });

  return {
    ctx,
    vocalIn,
    mrIn,
    delay,
    set,
    connectOutput,
    dispose: () => {
      try {
        bus.disconnect();
        master.disconnect();
        vocalIn.disconnect();
        mrIn.disconnect();
        delay.disconnect();
        feedback.disconnect();
        echoWet.disconnect();
        convolver.disconnect();
        reverbWet.disconnect();
      } catch {
        // ignore
      }
    },
  };
}

/** seconds of audio offset applied by the video-vs-audio sync slider */
export const syncOffsetSec = (settings: TakeSettings) => clamp(settings.syncMs, -500, 500) / 1000;
