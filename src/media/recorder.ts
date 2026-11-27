/**
 * Real MediaRecorder capture for the recording screen.
 *
 * Preferred path: two recorders on the same camera stream — a video-only file
 * (mute-able <video>) and a mic-only file — so the Result screen can mix the
 * vocal independently of the MR. When a browser refuses the second recorder we
 * fall back to one combined video+mic recording, and when there is no camera at
 * all we simply report `none` (the designed mock preview stays in charge).
 *
 * MIME selection follows the iOS Safari → Chrome order:
 *   video: video/mp4 → video/webm;codecs=vp8,opus → video/webm
 *   audio: audio/mp4 → audio/webm;codecs=opus → audio/webm
 */

export interface AudioVideoBlob {
  blob: any;
  mime: string;
}

export interface TakeRecording {
  mode: 'dual' | 'single' | 'video-only' | 'audio-only' | 'none';
  video: AudioVideoBlob | null;
  vocal: AudioVideoBlob | null;
  combined: AudioVideoBlob | null;
  durationSec: number;
}

export interface TakeRecorder {
  mode: TakeRecording['mode'];
  pause: () => void;
  resume: () => void;
  elapsed: () => number;
  stop: () => Promise<TakeRecording>;
  cancel: () => void;
}

const g = () => globalThis as unknown as Record<string, any>;

export function mediaRecorderSupported() {
  return typeof g().MediaRecorder === 'function';
}

const supports = (mime: string) => {
  const MR = g().MediaRecorder;
  if (!MR) return false;
  if (typeof MR.isTypeSupported !== 'function') return true;
  try {
    return Boolean(MR.isTypeSupported(mime));
  } catch {
    return false;
  }
};

export function pickVideoMime(): string {
  const candidates = [
    'video/mp4',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  return candidates.find(supports) ?? '';
}

export function pickAudioMime(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find(supports) ?? '';
}

interface Part {
  recorder: any;
  chunks: any[];
  mime: string;
  finished: boolean;
}

function makePart(stream: any, mime: string, video: boolean): Part | null {
  const MR = g().MediaRecorder;
  if (!MR || !stream) return null;
  let recorder: any;
  try {
    const options: any = {};
    if (mime) options.mimeType = mime;
    if (video) options.videoBitsPerSecond = 2_500_000;
    else options.audioBitsPerSecond = 128_000;
    recorder = mime ? new MR(stream, options) : new MR(stream);
  } catch {
    return null;
  }
  const chunks: any[] = [];
  const part: Part = { recorder, chunks, mime, finished: false };
  recorder.ondataavailable = (event: any) => {
    if (event?.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    part.finished = true;
  };
  try {
    recorder.start(500);
  } catch {
    return null;
  }
  return part;
}

const partBlob = (part: Part | null): AudioVideoBlob | null => {
  if (!part) return null;
  const mime = part.recorder.mimeType || part.mime || 'video/webm';
  const chunks = part.chunks.filter(Boolean);
  if (chunks.length === 0) return null;
  try {
    return { blob: new Blob(chunks, { type: mime }), mime };
  } catch {
    return null;
  }
};

const stopPart = (part: Part | null): Promise<AudioVideoBlob | null> =>
  new Promise(resolve => {
    if (!part) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(partBlob(part));
    };
    try {
      if (part.recorder.state === 'inactive') {
        finish();
        return;
      }
      part.recorder.onstop = finish;
      part.recorder.stop();
      setTimeout(finish, 2500);
    } catch {
      finish();
    }
  });

export function startTakeRecording(stream: any): TakeRecorder {
  const startedAt = Date.now();
  let pausedTotal = 0;
  let pauseStartedAt = 0;
  let stopped = false;

  const videoTracks: any[] = stream?.getVideoTracks?.() ?? [];
  const audioTracks: any[] = stream?.getAudioTracks?.() ?? [];

  let videoPart: Part | null = null;
  let audioPart: Part | null = null;
  let combinedPart: Part | null = null;
  let mode: TakeRecording['mode'] = 'none';

  const win = g();
  if (stream && videoTracks.length > 0 && audioTracks.length > 0 && win.MediaStream) {
    const videoOnly = new win.MediaStream(videoTracks);
    const audioOnly = new win.MediaStream(audioTracks);
    videoPart = makePart(videoOnly, pickVideoMime(), true);
    audioPart = makePart(audioOnly, pickAudioMime(), false);
    if (videoPart && audioPart) {
      mode = 'dual';
    } else {
      // roll back and use one recorder on the whole stream
      try {
        videoPart?.recorder.stop();
      } catch {
        // ignore
      }
      try {
        audioPart?.recorder.stop();
      } catch {
        // ignore
      }
      videoPart = null;
      audioPart = null;
      combinedPart = makePart(stream, pickVideoMime() || pickAudioMime(), true);
      if (combinedPart) mode = 'single';
    }
  } else if (stream && videoTracks.length > 0) {
    videoPart = makePart(new win.MediaStream(videoTracks), pickVideoMime(), true);
    if (videoPart) mode = 'video-only';
  } else if (stream && audioTracks.length > 0) {
    audioPart = makePart(new win.MediaStream(audioTracks), pickAudioMime(), false);
    if (audioPart) mode = 'audio-only';
  }

  const elapsed = () => {
    const now = Date.now();
    const paused = pausedTotal + (pauseStartedAt ? now - pauseStartedAt : 0);
    return Math.max(0, (now - startedAt - paused) / 1000);
  };

  const pause = () => {
    if (stopped) return;
    pauseStartedAt = Date.now();
    [videoPart, audioPart, combinedPart].forEach(part => {
      try {
        if (part && part.recorder.state === 'recording') part.recorder.pause();
      } catch {
        // ignore
      }
    });
  };

  const resume = () => {
    if (stopped) return;
    if (pauseStartedAt) {
      pausedTotal += Date.now() - pauseStartedAt;
      pauseStartedAt = 0;
    }
    [videoPart, audioPart, combinedPart].forEach(part => {
      try {
        if (part && part.recorder.state === 'paused') part.recorder.resume();
      } catch {
        // ignore
      }
    });
  };

  const durationSec = () => Math.max(0.2, elapsed());

  const stopAll = async (): Promise<TakeRecording> => {
    stopped = true;
    const duration = durationSec();
    if (mode === 'dual') {
      const [video, vocal] = await Promise.all([stopPart(videoPart), stopPart(audioPart)]);
      return { mode, video, vocal, combined: null, durationSec: duration };
    }
    if (mode === 'video-only') {
      const video = await stopPart(videoPart);
      return { mode, video, vocal: null, combined: null, durationSec: duration };
    }
    if (mode === 'single' || mode === 'audio-only') {
      const combined = await stopPart(combinedPart ?? audioPart);
      return { mode, video: mode === 'single' ? combined : null, vocal: combined, combined, durationSec: duration };
    }
    return { mode, video: null, vocal: null, combined: null, durationSec: duration };
  };

  const cancel = () => {
    stopped = true;
    [videoPart, audioPart, combinedPart].forEach(part => {
      try {
        if (part && part.recorder.state !== 'inactive') part.recorder.stop();
      } catch {
        // ignore
      }
    });
    videoPart = null;
    audioPart = null;
    combinedPart = null;
  };

  return { mode, pause, resume, elapsed, stop: stopAll, cancel };
}
