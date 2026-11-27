/**
 * Result-screen playback engine: recorded video + recorded vocal + MR, all
 * routed through one live mix graph so the sliders change the sound instantly.
 */
import { Song, TakeSettings } from '../types';
import { createMixGraph, getAudioContext, loadAudioBuffer, MixGraph, resumeAudio, syncOffsetSec } from './webaudio';
import { createMrSource, MrSource } from './mr';

export interface TakeMixerOptions {
  song: Song;
  durationSec: number;
  settings: TakeSettings;
  vocalUrl?: string;
  getVideo?: () => any;
}

export interface TakeMixer {
  hasVocal: boolean;
  hasMr: boolean;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (pos: number) => void;
  setSettings: (settings: TakeSettings) => void;
  position: () => number;
  isPlaying: () => boolean;
  dispose: () => void;
}

export async function createTakeMixer(options: TakeMixerOptions): Promise<TakeMixer | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;

  const graph: MixGraph = createMixGraph(ctx);
  let settings = options.settings;
  graph.set(settings);

  const mr: MrSource | null = await createMrSource(options.song, ctx, graph.mrIn);
  const vocalBuffer = options.vocalUrl ? await loadAudioBuffer(ctx, options.vocalUrl) : null;

  let vocalSource: any = null;
  let playing = false;
  let anchorPos = 0;
  let anchorTime = 0;

  const duration = Math.max(1, options.durationSec);

  const videoTime = () => {
    const el = options.getVideo?.();
    if (!el || el.readyState < 2) return null;
    if (Number.isNaN(el.currentTime)) return null;
    return el.currentTime as number;
  };

  const position = () => {
    const vt = videoTime();
    if (vt !== null) return Math.min(duration, Math.max(0, vt));
    if (!playing) return anchorPos;
    return Math.min(duration, Math.max(0, anchorPos + (ctx.currentTime - anchorTime)));
  };

  const stopAudio = () => {
    try {
      vocalSource?.stop();
    } catch {
      // ignore
    }
    vocalSource = null;
    mr?.stop();
  };

  const startAudio = (fromPos: number) => {
    // positive sync = the audio content sits behind the video frame
    const contentPos = fromPos - syncOffsetSec(settings);
    const wait = Math.max(0, -contentPos);
    const offset = Math.max(0, contentPos);

    if (vocalBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = vocalBuffer;
        source.connect(graph.vocalIn);
        source.start(
          ctx.currentTime + wait,
          Math.min(offset, Math.max(0, vocalBuffer.duration - 0.02)),
        );
        vocalSource = source;
      } catch {
        vocalSource = null;
      }
    }
    mr?.play(Math.min(offset, Math.max(0, (mr.duration || duration) - 0.05)), wait);
  };

  const play = async () => {
    await resumeAudio(ctx);
    if (playing) return;
    let from = position();
    if (from >= duration - 0.08) from = 0;

    const el = options.getVideo?.();
    if (el) {
      try {
        el.currentTime = from;
        await el.play();
      } catch {
        // autoplay may be blocked; audio still starts below
      }
    }
    startAudio(from);
    anchorPos = from;
    anchorTime = ctx.currentTime;
    playing = true;
  };

  const pause = () => {
    if (!playing) return;
    anchorPos = position();
    playing = false;
    stopAudio();
    const el = options.getVideo?.();
    if (el) {
      try {
        el.pause();
      } catch {
        // ignore
      }
    }
  };

  const seek = (pos: number) => {
    const next = Math.min(duration, Math.max(0, pos));
    const el = options.getVideo?.();
    if (el) {
      try {
        el.currentTime = next;
      } catch {
        // ignore
      }
    }
    anchorPos = next;
    anchorTime = ctx.currentTime;
    if (playing) {
      stopAudio();
      startAudio(next);
      if (mr && !mr.isReal) {
        // the synth restarts from its own top; keep it audible
      }
    }
  };

  const setSettings = (next: TakeSettings) => {
    const syncChanged = next.syncMs !== settings.syncMs;
    settings = next;
    graph.set(settings);
    if (playing && syncChanged) {
      const p = position();
      stopAudio();
      startAudio(p);
    }
  };

  const dispose = () => {
    stopAudio();
    mr?.dispose();
    graph.dispose();
    playing = false;
  };

  return {
    hasVocal: Boolean(vocalBuffer),
    hasMr: Boolean(mr),
    duration,
    play,
    pause,
    seek,
    setSettings,
    position,
    isPlaying: () => playing,
    dispose,
  };
}
