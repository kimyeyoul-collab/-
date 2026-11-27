/**
 * The MR track of a song: the real audio file uploaded in the creator studio,
 * or the Web Audio synth for the demo catalogue.
 */
import { Song } from '../types';
import { loadAudioBuffer } from './webaudio';
import { modeForGenre, startSynthOn, SynthHandle } from './synth';

export interface MrSource {
  /** true when a real audio file (uploaded MR) is playing */
  isReal: boolean;
  duration: number;
  play: (fromSec?: number, delaySec?: number) => void;
  stop: () => void;
  dispose: () => void;
}

export const hasRealAudio = (song: Song) => Boolean(song.audioUrl);

/** Warm the decode cache before recording starts so playback is instant. */
export async function preloadMr(song: Song, ctx: any) {
  if (!ctx || !song.audioUrl) return null;
  return loadAudioBuffer(ctx, song.audioUrl);
}

export async function createMrSource(
  song: Song,
  ctx: any,
  destination: any,
): Promise<MrSource | null> {
  if (!ctx) return null;

  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(destination);

  if (song.audioUrl) {
    const buffer = await loadAudioBuffer(ctx, song.audioUrl);
    if (buffer) {
      let source: any = null;
      const duration = Math.min(buffer.duration, song.durationSec || buffer.duration);
      return {
        isReal: true,
        duration,
        play: (fromSec = 0, delaySec = 0) => {
          try {
            if (source) source.stop();
          } catch {
            // already stopped
          }
          const offset = Math.max(0, Math.min(fromSec, buffer.duration - 0.02));
          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(gain);
          source.start(ctx.currentTime + Math.max(0, delaySec), offset);
        },
        stop: () => {
          try {
            source?.stop();
          } catch {
            // ignore
          }
          source = null;
        },
        dispose: () => {
          try {
            source?.stop();
            gain.disconnect();
          } catch {
            // ignore
          }
        },
      };
    }
  }

  // demo song → Web Audio synth (cannot seek, plays from the top)
  let synth: SynthHandle | null = null;
  const mode = modeForGenre(song.genre);
  return {
    isReal: false,
    duration: song.durationSec,
    play: () => {
      if (synth) return;
      synth = startSynthOn(ctx, mode, song.bpm || 90, { destination: gain, gain: 0.55 });
    },
    stop: () => {
      synth?.stop();
      synth = null;
    },
    dispose: () => {
      synth?.stop();
      synth = null;
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    },
  };
}
