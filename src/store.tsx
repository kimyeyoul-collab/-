import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, TakeResult, UploadedMr } from './types';
import { initialUploads } from './data/mock';
import { uid } from './utils/format';

export type Route =
  | { name: 'home' }
  | { name: 'song'; songId: string }
  | { name: 'recording'; songId: string }
  | { name: 'result'; songId: string }
  | { name: 'creator' };

export type ToastTone = 'ok' | 'alert';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface Store {
  route: Route;
  depth: number;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  back: () => void;
  goHome: () => void;

  uploads: UploadedMr[];
  addUpload: (upload: UploadedMr) => void;

  favorites: string[];
  toggleFavorite: (songId: string) => void;

  take: TakeResult | null;
  setTake: (take: TakeResult) => void;

  toast: ToastState | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [uploads, setUploads] = useState<UploadedMr[]>(initialUploads);
  const [favorites, setFavorites] = useState<string[]>(['s1']);
  const [take, setTakeState] = useState<TakeResult | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const route = stack[stack.length - 1];

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    setStack(current => (options?.replace ? [...current.slice(0, -1), next] : [...current, next]));
  }, []);

  const back = useCallback(() => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const goHome = useCallback(() => setStack([{ name: 'home' }]), []);

  const addUpload = useCallback((upload: UploadedMr) => {
    setUploads(current => [upload, ...current]);
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    setFavorites(current =>
      current.includes(songId) ? current.filter(id => id !== songId) : [...current, songId],
    );
  }, []);

  const setTake = useCallback((next: TakeResult) => setTakeState(next), []);

  const showToast = useCallback((message: string, tone: ToastTone = 'ok') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<Store>(
    () => ({
      route,
      depth: stack.length,
      navigate,
      back,
      goHome,
      uploads,
      addUpload,
      favorites,
      toggleFavorite,
      take,
      setTake,
      toast,
      showToast,
      dismissToast,
    }),
    [
      route,
      stack.length,
      navigate,
      back,
      goHome,
      uploads,
      addUpload,
      favorites,
      toggleFavorite,
      take,
      setTake,
      toast,
      showToast,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Recording takes keep their mix settings so Result can start from them. */
export function makeTake(songId: string, durationSec: number, settings = DEFAULT_SETTINGS): TakeResult {
  return { songId, durationSec, settings, createdAt: Date.now() };
}

export const newUploadId = () => uid('mr');
