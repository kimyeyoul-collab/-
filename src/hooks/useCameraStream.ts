import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getAudioContext, resumeAudio } from '../audio/webaudio';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported';

/**
 * Web: real front camera + microphone through getUserMedia, rendered into a
 * <video> node we create ourselves because react-native-web gives us a plain
 * <div> container to attach it to. The same stream feeds the MediaRecorder.
 * Native / denied / no device: the recording screen shows its designed mock view.
 */
export function useCameraStream() {
  const isWeb = Platform.OS === 'web';
  const [status, setStatus] = useState<CameraStatus>(isWeb ? 'idle' : 'unsupported');
  const [container, setContainer] = useState<any>(null);
  const streamRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const sourceRef = useRef<any>(null);
  const bufferRef = useRef<any>(null);

  const setContainerRef = useCallback((node: any) => {
    setContainer(node ?? null);
  }, []);

  useEffect(() => {
    if (!container || !streamRef.current || status !== 'live') return;
    const doc = (globalThis as unknown as Record<string, any>).document;
    if (!doc) return;
    let video = videoRef.current;
    if (!video) {
      video = doc.createElement('video');
      video.setAttribute('playsinline', 'playsinline');
      video.setAttribute('autoplay', 'autoplay');
      video.setAttribute('muted', 'muted');
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.transform = 'scaleX(-1)';
      video.style.display = 'block';
      videoRef.current = video;
    }
    if (video.parentNode !== container) container.appendChild(video);
    if (video.srcObject !== streamRef.current) video.srcObject = streamRef.current;
    const promise = video.play?.();
    if (promise && typeof promise.catch === 'function') promise.catch(() => undefined);
  }, [container, status]);

  const request = useCallback(async (): Promise<any | null> => {
    if (streamRef.current) {
      setStatus('live');
      return streamRef.current;
    }
    const nav = (globalThis as unknown as Record<string, any>).navigator;
    if (!nav?.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return null;
    }
    setStatus('requesting');
    const videoConstraints = {
      facingMode: 'user',
      width: { ideal: 720 },
      height: { ideal: 1280 },
      aspectRatio: { ideal: 9 / 16 },
    };
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    let stream: any = null;
    try {
      stream = await nav.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
    } catch {
      try {
        stream = await nav.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
      } catch {
        try {
          stream = await nav.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch {
          setStatus('denied');
          return null;
        }
      }
    }

    streamRef.current = stream;
    setStatus('live');

    // real mic level + the shared AudioContext that will also play the MR
    try {
      const ctx = getAudioContext();
      const audioTrack = stream.getAudioTracks?.()[0];
      if (ctx && audioTrack) {
        await resumeAudio(ctx);
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        sourceRef.current = source;
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // analyser is optional
    }

    return stream;
  }, []);

  /** 0..1 microphone level, or 0 when no analyser is available. */
  const getLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const buffer = bufferRef.current;
    if (!analyser || !buffer) return 0;
    try {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
    } catch {
      return 0;
    }
  }, []);

  const stream = useCallback(() => streamRef.current, []);

  const stop = useCallback(() => {
    const current = streamRef.current;
    if (current?.getTracks) current.getTracks().forEach((track: any) => track.stop());
    streamRef.current = null;
    try {
      sourceRef.current?.disconnect();
    } catch {
      // ignore
    }
    sourceRef.current = null;
    analyserRef.current = null;
    bufferRef.current = null;
    const video = videoRef.current;
    if (video?.parentNode) video.parentNode.removeChild(video);
    videoRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(
    () => () => {
      const current = streamRef.current;
      if (current?.getTracks) current.getTracks().forEach((track: any) => track.stop());
      try {
        sourceRef.current?.disconnect();
      } catch {
        // ignore
      }
      const video = videoRef.current;
      if (video?.parentNode) video.parentNode.removeChild(video);
      streamRef.current = null;
      videoRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      bufferRef.current = null;
    },
    [],
  );

  return { status, request, setContainerRef, getLevel, stream, stop };
}
