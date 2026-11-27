/**
 * Tiny Web Audio "MR" synthesizer used for the preview / recording demo on web.
 * On native (or any environment without AudioContext) callers fall back to a
 * silent timer so the UI still behaves like a player.
 */

export type SynthHandle = { stop: () => void };

export type SynthMode = 'ballad' | 'pop' | 'rnb';

const CHORDS: Record<SynthMode, number[][]> = {
  ballad: [
    [57, 60, 64],
    [55, 59, 62],
    [53, 57, 60],
    [52, 55, 59],
  ],
  pop: [
    [60, 64, 67],
    [57, 60, 64],
    [53, 57, 60],
    [55, 59, 62],
  ],
  rnb: [
    [58, 62, 65],
    [56, 60, 63],
    [53, 57, 60],
    [55, 58, 62],
  ],
};

const MELODY = [72, 74, 76, 79, 81, 79, 76, 74, 72, 76, 79, 84];

const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const synthSupported = () => {
  const g = globalThis as unknown as Record<string, unknown>;
  return typeof (g.AudioContext ?? g.webkitAudioContext) === 'function';
};

export function startSynth(mode: SynthMode = 'ballad', bpm = 80): SynthHandle | null {
  const g = globalThis as unknown as Record<string, any>;
  const AudioCtor = g.AudioContext ?? g.webkitAudioContext;
  if (typeof AudioCtor !== 'function') return null;

  let ctx: any;
  try {
    ctx = new AudioCtor();
  } catch {
    return null;
  }

  const master: any = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  const beat = 60 / bpm;
  const stepDur = beat / 2;
  const chords = CHORDS[mode];
  let step = 0;
  let stopped = false;
  let nextTime = ctx.currentTime + 0.08;

  const tone = (
    freq: number,
    at: number,
    dur: number,
    opts: { type?: string; gain?: number; glideTo?: number } = {},
  ) => {
    if (stopped) return;
    const osc: any = ctx.createOscillator();
    const env: any = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, at);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, at + dur);

    const peak = opts.gain ?? 0.06;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(env);
    env.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  const schedule = () => {
    while (nextTime < ctx.currentTime + 0.5) {
      const at = nextTime;
      const chordIndex = Math.floor(step / 8) % chords.length;
      const chord = chords[chordIndex];

      // pad on every chord change
      if (step % 8 === 0) {
        chord.forEach((n, i) => tone(midiToFreq(n), at, beat * 4, { type: 'sine', gain: 0.035 - i * 0.004 }));
      }

      // soft bass
      if (step % 4 === 0) {
        tone(midiToFreq(chord[0] - 12), at, beat * 1.8, { type: 'sine', gain: 0.09 });
      }

      // kick
      if (step % 4 === 0) {
        tone(120, at, 0.22, { type: 'sine', gain: 0.16, glideTo: 46 });
      }

      // hat
      if (step % 2 === 1) {
        tone(8200, at, 0.03, { type: 'square', gain: 0.012 });
      }

      // melody line
      if (step % 2 === 0) {
        const note = MELODY[(step / 2) % MELODY.length];
        tone(midiToFreq(note), at, beat * 0.85, { type: 'triangle', gain: 0.05 });
      }

      step += 1;
      nextTime += stepDur;
    }
  };

  const timer = setInterval(schedule, 120);
  schedule();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      try {
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          ctx.close();
        } catch {
          // ignore
        }
      }, 350);
    },
  };
}

export const modeForGenre = (genre: string): SynthMode => {
  if (genre === 'K-POP' || genre === '힙합') return 'pop';
  if (genre === 'R&B') return 'rnb';
  return 'ballad';
};
