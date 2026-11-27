export type Genre = '발라드' | 'K-POP' | '인디' | 'R&B' | '힙합' | '트로트';

export type Difficulty = '쉬움' | '보통' | '어려움';

export interface LyricLine {
  /** seconds from the start of the MR */
  start: number;
  end: number;
  text: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  /** length of the cover cut used by the studio (intro + 1 verse + chorus) */
  durationSec: number;
  /** original full track length */
  fullDurationSec: number;
  difficulty: Difficulty;
  key: string;
  bpm: number;
  plays: number;
  creatorId: string;
  price: number;
  cover: [string, string];
  lyrics: LyricLine[];
  isNew?: boolean;
  releasedDaysAgo: number;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  mrCount: number;
  plays: number;
  verified: boolean;
  accent: [string, string];
  tagline: string;
}

export interface UploadedMr {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  price: number;
  fileName: string;
  createdAt: string;
  sales: number;
  revenue: number;
  status: '판매 중' | '심사 중';
  isNew?: boolean;
}

export interface TakeSettings {
  vocal: number;
  mr: number;
  echo: number;
  reverb: number;
  syncMs: number;
}

export interface TakeResult {
  songId: string;
  durationSec: number;
  settings: TakeSettings;
  createdAt: number;
}

export const DEFAULT_SETTINGS: TakeSettings = {
  vocal: 80,
  mr: 65,
  echo: 28,
  reverb: 34,
  syncMs: 0,
};
