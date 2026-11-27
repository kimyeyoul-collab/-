/**
 * Real 9:16 cover video export.
 *
 * A hidden canvas paints the recorded camera frames plus the synced lyric
 * subtitle at 30fps, while the mixed audio (vocal + echo + reverb + MR) is
 * captured through a MediaStreamAudioDestinationNode. canvas.captureStream(30)
 * and that audio track are recorded together with MediaRecorder, so the result
 * is an actual playable video file (mp4 on Safari, webm on Chrome).
 */
import { LyricLine, Song, TakeSettings } from '../types';
import { createMixGraph, syncOffsetSec } from '../audio/webaudio';
import { createMrSource } from '../audio/mr';
import { drawCoverFrame } from './drawCover';
import { pickVideoMime } from './recorder';

export interface ExportOptions {
  song: Pick<Song, 'title' | 'artist' | 'cover' | 'lyrics' | 'genre' | 'bpm' | 'audioUrl'> & {
    lyrics: LyricLine[];
  };
  durationSec: number;
  videoUrl?: string;
  vocalUrl?: string;
  settings: TakeSettings;
  width?: number;
  height?: number;
  onProgress?: (ratio: number, elapsedSec: number) => void;
  isCancelled?: () => boolean;
}

export interface ExportResult {
  blob: any;
  mime: string;
  extension: 'mp4' | 'webm';
  width: number;
  height: number;
  durationSec: number;
}

const waitFor = <T,>(check: () => T | null, timeoutMs = 4000): Promise<T | null> =>
  new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      const value = check();
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, 60);
    };
    tick();
  });

export async function exportCoverVideo(options: ExportOptions): Promise<ExportResult> {
  const doc = (globalThis as unknown as Record<string, any>).document;
  const win = globalThis as unknown as Record<string, any>;
  if (!doc) throw new Error('canvas export needs a browser');

  const width = options.width ?? 720;
  const height = options.height ?? 1280;
  const duration = Math.max(0.6, options.durationSec);

  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-10000px';
  canvas.style.top = '0';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.opacity = '0';
  doc.body.appendChild(canvas);
  const c2d = canvas.getContext('2d');
  if (!c2d) {
    canvas.remove();
    throw new Error('canvas 2d context unavailable');
  }

  // recorded video used as the picture source
  let video: any = null;
  if (options.videoUrl) {
    video = doc.createElement('video');
    video.src = options.videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    doc.body.appendChild(video);
    await waitFor(() => (video.readyState >= 2 ? true : null), 4000);
  }

  const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
  const audioCtx: any = typeof AudioCtor === 'function' ? new AudioCtor() : null;
  if (audioCtx) {
    try {
      await audioCtx.resume();
    } catch {
      // ignore
    }
  }

  const streamDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;
  const graph = audioCtx
    ? createMixGraph(audioCtx, streamDest ? [audioCtx.destination, streamDest] : [audioCtx.destination])
    : null;
  graph?.set(options.settings);

  const mr = graph ? await createMrSource(options.song as Song, audioCtx, graph.mrIn) : null;
  let vocalBuffer: any = null;
  if (audioCtx && options.vocalUrl) {
    try {
      const res = await fetch(options.vocalUrl);
      vocalBuffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
    } catch {
      vocalBuffer = null;
    }
  }

  const sync = syncOffsetSec(options.settings);

  // MediaRecorder mime
  const videoMime = pickVideoMime();
  const MR = win.MediaRecorder;
  if (typeof MR !== 'function') {
    canvas.remove();
    video?.remove();
    try {
      audioCtx?.close();
    } catch {
      // ignore
    }
    throw new Error('MediaRecorder unavailable');
  }

  const drawAt = (elapsed: number) => {
    const lyrics = options.song.lyrics ?? [];
    drawCoverFrame(c2d, {
      width,
      height,
      time: Math.max(0, elapsed - sync),
      video,
      cover: options.song.cover ?? ['#1B2430', '#0E1116'],
      title: options.song.title,
      artist: options.song.artist,
      lyrics,
      progress: Math.min(1, elapsed / duration),
      duration,
    });
  };

  drawAt(0);

  let canvasStream: any = null;
  try {
    canvasStream = canvas.captureStream(30);
  } catch {
    canvasStream = null;
  }
  if (!canvasStream) {
    canvas.remove();
    video?.remove();
    try {
      audioCtx?.close();
    } catch {
      // ignore
    }
    throw new Error('canvas.captureStream unavailable');
  }

  const tracks: any[] = [...canvasStream.getVideoTracks()];
  if (streamDest) tracks.push(...streamDest.stream.getAudioTracks());
  const combined = new win.MediaStream(tracks);

  const chunks: any[] = [];
  let recorder: any;
  try {
    recorder = new MR(combined, {
      ...(videoMime ? { mimeType: videoMime } : {}),
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 160_000,
    });
  } catch {
    recorder = new MR(combined);
  }
  recorder.ondataavailable = (event: any) => {
    if (event?.data && event.data.size > 0) chunks.push(event.data);
  };

  const startedAt = performance.now();
  recorder.start(500);

  if (video) {
    try {
      video.currentTime = 0;
      await video.play();
    } catch {
      // a paused frame still exports
    }
  }

  if (audioCtx) {
    const now = audioCtx.currentTime;
    const contentPos = Math.max(0, 0 - sync);
    const wait = Math.max(0, sync);
    if (vocalBuffer) {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = vocalBuffer;
        source.connect(graph!.vocalIn);
        source.start(now + wait, Math.min(contentPos, Math.max(0, vocalBuffer.duration - 0.02)));
      } catch {
        // ignore
      }
    }
    mr?.play(Math.min(contentPos, Math.max(0, (mr.duration || duration) - 0.05)), wait);
  }

  let lastDraw = 0;
  let lastProgress = 0;
  await new Promise<void>(resolve => {
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const visible = Math.min(elapsed, duration);
      if (visible !== lastDraw) {
        drawAt(visible);
        lastDraw = visible;
      }
      if (visible - lastProgress > 0.25) {
        lastProgress = visible;
        options.onProgress?.(Math.min(1, visible / duration), visible);
      }
      const cancelled = options.isCancelled?.() ?? false;
      if (cancelled || elapsed >= duration) {
        resolve();
        return;
      }
      if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(tick);
      else setTimeout(tick, 33);
    };
    tick();
  });

  const blob = await new Promise<any>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const mime = recorder.mimeType || videoMime || 'video/webm';
      try {
        resolve(new Blob(chunks, { type: mime }));
      } catch {
        resolve(null);
      }
    };
    try {
      recorder.onstop = finish;
      recorder.stop();
      setTimeout(finish, 3000);
    } catch {
      finish();
    }
  });

  mr?.dispose();
  graph?.dispose();
  try {
    combined.getTracks().forEach((track: any) => track.stop());
  } catch {
    // ignore
  }
  try {
    video?.pause();
  } catch {
    // ignore
  }
  video?.remove?.();
  canvas.remove();
  try {
    await audioCtx?.close();
  } catch {
    // ignore
  }

  if (!blob || blob.size === 0) throw new Error('empty recording');

  const mime = blob.type || videoMime || 'video/webm';
  return {
    blob,
    mime,
    extension: mime.includes('mp4') ? 'mp4' : 'webm',
    width,
    height,
    durationSec: duration,
  };
}

export function downloadVideo(blob: any, fileName: string) {
  const doc = (globalThis as unknown as Record<string, any>).document;
  if (!doc) return false;
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
  return true;
}

export function videoFile(blob: any, fileName: string) {
  const win = globalThis as unknown as Record<string, any>;
  if (typeof win.File !== 'function') return null;
  try {
    return new win.File([blob], fileName, { type: blob.type || 'video/webm' });
  } catch {
    return null;
  }
}

/** Web Share API with a real file; returns false when the browser can't. */
export async function shareVideo(blob: any, fileName: string, title: string, text: string) {
  const nav = (globalThis as unknown as Record<string, any>).navigator;
  const file = videoFile(blob, fileName);
  if (!nav?.share || !file) return false;
  try {
    if (typeof nav.canShare === 'function' && !nav.canShare({ files: [file] })) return false;
    await nav.share({ files: [file], title, text });
    return true;
  } catch {
    return false;
  }
}
