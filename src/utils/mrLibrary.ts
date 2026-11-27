/**
 * Tiny persistence layer for creator-uploaded MR files: metadata in
 * localStorage, the audio blob itself in IndexedDB, so a page reload keeps the
 * song in the catalogue with its real audio.
 */
import { UploadedMr } from '../types';

const META_KEY = 'kcs_mr_uploads_v1';
const DB_NAME = 'kcs_mr_library';
const STORE = 'audio';

const win = () => globalThis as unknown as Record<string, any>;

export function loadUploadMeta(): UploadedMr[] {
  try {
    const raw = win().localStorage?.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) => item && typeof item.id === 'string' && item.id);
  } catch {
    return [];
  }
}

export function saveUploadMeta(uploads: UploadedMr[]) {
  try {
    const serializable = uploads
      .filter(item => !item.demo)
      .map(({ audioUrl, ...rest }) => {
        void audioUrl;
        return rest;
      });
    win().localStorage?.setItem(META_KEY, JSON.stringify(serializable));
  } catch {
    // private mode / quota
  }
}

function openDb(): Promise<any | null> {
  const idb = win().indexedDB;
  if (!idb) return Promise.resolve(null);
  return new Promise(resolve => {
    let request: any;
    try {
      request = idb.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function putAudioBlob(id: string, blob: any): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getAudioBlob(id: string): Promise<any | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteAudioBlob(id: string) {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
  } catch {
    // ignore
  }
}

/** Re-attach stored blobs as object URLs after a reload. */
export async function restoreUploads(): Promise<UploadedMr[]> {
  const meta = loadUploadMeta();
  const restored: UploadedMr[] = [];
  for (const item of meta) {
    const blob = await getAudioBlob(item.id);
    if (!blob) continue;
    try {
      restored.push({ ...item, audioUrl: URL.createObjectURL(blob) });
    } catch {
      restored.push(item);
    }
  }
  return restored;
}

/** Read a media file's duration without decoding the whole thing twice. */
export function readAudioDuration(url: string): Promise<number> {
  const doc = win().document;
  if (!doc) return Promise.resolve(0);
  return new Promise(resolve => {
    const audio = doc.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
      audio.removeAttribute?.('src');
      audio.load?.();
    };
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    setTimeout(() => finish(audio.duration), 3500);
  });
}

export function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
