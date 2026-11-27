import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported';

/**
 * Web: real front camera (+ mic analyser when available) through getUserMedia,
 * rendered into a <video> node we create ourselves because react-native-web
 * gives us a plain <div> container to attach it to.
 * Native / denied / no device: the recording screen shows a designed mock view.
 */
export function useCameraStream() {
  const isWeb = Platform.OS === 'web';
  const [status, setStatus] = useState<CameraStatus>(isWeb ? 'idle' : 'unsupported');
  const [container, setContainer] = useState<any>(null);
  const streamRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const bufferRef = useRef<any>(null);

  const setContainerRef = useCallback((node: any) => {
    setContainer(node ?? null);
  }, []);

  useEffect(() => {
    if (!container || !streamRef.current) return;
    const doc = (globalThis as unknown as Record<string, any>).document;
    if (!doc) return;
    let video = videoRef.current;
    if (!video) {
      video = doc.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.transform = 'scaleX(-1)';
      video.style.display = 'block';
      videoRef.current = video;
    }
    if (video.parentNode !== container) container.appendChild(video);
    video.srcObject = streamRef.current;
    const promise = video.play?.();
    if (promise && typeof promise.catch === 'function') promise.catch(() => undefined);
  }, [container]);

  const request = useCallback(async () => {
    const nav = (globalThis as unknown as Record<string, any>).navigator;
    if (!nav?.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    let stream: any = null;
    try {
      stream = await nav.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 720, height: 1280 },
        audio: true,
      });
    } catch {
      try {
        stream = await nav.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 720, height: 1280 },
          audio: false,
        });
      } catch {
        setStatus('denied');
        return;
      }
    }

    streamRef.current = stream;

    // real mic level when the browser gave us an audio track
    try {
      const g = globalThis as unknown as Record<string, any>;
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      const audioTrack = stream.getAudioTracks?.()[0];
      if (Ctor && audioTrack) {
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // analyser is optional
    }

    setStatus('live');
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

  useEffect(
    () => () => {
      const stream = streamRef.current;
      if (stream?.getTracks) stream.getTracks().forEach((track: any) => track.stop());
      const video = videoRef.current;
      if (video?.parentNode) video.parentNode.removeChild(video);
      try {
        audioCtxRef.current?.close();
      } catch {
        // ignore
      }
      streamRef.current = null;
      videoRef.current = null;
      analyserRef.current = null;
      audioCtxRef.current = null;
      bufferRef.current = null;
    },
    [],
  );

  return { status, request, setContainerRef, getLevel };
}
