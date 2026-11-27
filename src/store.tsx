import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, Song, TakeResult, UploadedMr } from './types';
import { initialUploads, songs as demoCatalog } from './data/mock';
import { uid } from './utils/format';
import { putAudioBlob, restoreUploads, saveUploadMeta } from './utils/mrLibrary';

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
  addUpload: (upload: UploadedMr, blob?: any) => Promise<void>;

  /** demo catalogue + every uploaded MR (newest first) */
  songs: Song[];
  getSong: (songId: string | undefined) => Song;

  favorites: string[];
  toggleFavorite: (songId: string) => void;

  take: TakeResult | null;
  setTake: (take: TakeResult) => void;

  toast: ToastState | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

const StoreContext = createContext<Store | null>(null);

/** Uploaded MR → playable Song row for the home catalogue. */
export function uploadToSong(upload: UploadedMr): Song {
  const duration = Math.max(8, Math.round(upload.durationSec ?? 90));
  return {
    id: upload.id,
    title: upload.title,
    artist: upload.artist,
    genre: upload.genre,
    durationSec: duration,
    fullDurationSec: duration,
    difficulty: '보통',
    key: '—',
    bpm: 96,
    plays: 0,
    creatorId: 'c_me',
    price: upload.price,
    cover: ['#241820', '#0D1218'],
    lyrics: upload.lyrics ?? [],
    isNew: true,
    releasedDaysAgo: 0,
    audioUrl: upload.audioUrl,
    uploadId: upload.id,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [uploads, setUploads] = useState<UploadedMr[]>(initialUploads);
  const [favorites, setFavorites] = useState<string[]>(['s1']);
  const [take, setTakeState] = useState<TakeResult | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  /* restore creator uploads stored in IndexedDB by a previous visit */
  useEffect(() => {
    let alive = true;
    restoreUploads()
      .then(restored => {
        if (!alive || restored.length === 0) return;
        setUploads(current => {
          const existing = new Set(current.map(item => item.id));
          return [...restored.filter(item => !existing.has(item.id)), ...current];
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /* keep metadata for real uploads (demo rows are never persisted) */
  useEffect(() => {
    saveUploadMeta(uploads);
  }, [uploads]);

  const route = stack[stack.length - 1];

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    setStack(current => (options?.replace ? [...current.slice(0, -1), next] : [...current, next]));
  }, []);

  const back = useCallback(() => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const goHome = useCallback(() => setStack([{ name: 'home' }]), []);

  const addUpload = useCallback(async (upload: UploadedMr, blob?: any) => {
    if (blob) {
      await putAudioBlob(upload.id, blob);
    }
    setUploads(current => [upload, ...current]);
  }, []);

  const songs = useMemo<Song[]>(() => {
    const fromUploads = uploads.filter(item => Boolean(item.audioUrl)).map(uploadToSong);
    return [...fromUploads, ...demoCatalog];
  }, [uploads]);

  const getSong = useCallback(
    (songId: string | undefined) => songs.find(item => item.id === songId) ?? demoCatalog[0],
    [songs],
  );

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
      songs,
      getSong,
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
      songs,
      getSong,
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
