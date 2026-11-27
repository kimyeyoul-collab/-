import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../utils/format';

interface Clock {
  pos: number;
  playing: boolean;
  isFinished: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  reset: () => void;
  posRef: React.MutableRefObject<number>;
}

/**
 * A playback clock driven by wall time (requestAnimationFrame-free so it also
 * runs reliably inside RN Web and in a background tab). Pause keeps position.
 */
export function useClock(duration: number, onEnd?: () => void): Clock {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const posRef = useRef(0);
  const lastRef = useRef(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!playing) return;
    lastRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const next = Math.min(duration, posRef.current + delta);
      posRef.current = next;
      setPos(next);
      if (next >= duration) {
        setPlaying(false);
        endRef.current?.();
      }
    }, 80);
    return () => clearInterval(id);
  }, [playing, duration]);

  const play = useCallback(() => {
    setPlaying(current => {
      if (current) return current;
      if (posRef.current >= duration) posRef.current = 0;
      return true;
    });
    setPos(posRef.current);
  }, [duration]);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    setPlaying(current => {
      if (!current && posRef.current >= duration) posRef.current = 0;
      return !current;
    });
  }, [duration]);

  const seek = useCallback(
    (seconds: number) => {
      const next = clamp(seconds, 0, duration);
      posRef.current = next;
      setPos(next);
    },
    [duration],
  );

  const reset = useCallback(() => {
    posRef.current = 0;
    setPos(0);
    setPlaying(false);
  }, []);

  return {
    pos,
    playing,
    isFinished: duration > 0 && pos >= duration,
    play,
    pause,
    toggle,
    seek,
    reset,
    posRef,
  };
}

/** 3 → 2 → 1 countdown helper used by the recording screen. */
export function useCountdown() {
  const [count, setCount] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setCount(null);
  }, []);

  const start = useCallback(
    (from = 3, onDone?: () => void) => {
      stop();
      setCount(from);
      let current = from;
      timer.current = setInterval(() => {
        current -= 1;
        if (current <= 0) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setCount(null);
          onDone?.();
        } else {
          setCount(current);
        }
      }, 700);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { count, start, stop };
}
