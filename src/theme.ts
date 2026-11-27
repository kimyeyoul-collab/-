/**
 * Karaoke Cover Studio — design tokens.
 * Deep charcoal / navy base + coral accent. No purple anywhere.
 */
import { Platform } from 'react-native';

export const colors = {
  // base
  bg: '#080B10',
  bgSoft: '#0C1117',
  surface: '#121922',
  surfaceAlt: '#18212C',
  surfaceHi: '#1F2A37',
  border: '#22303F',
  borderStrong: '#2E4053',

  // accents
  coral: '#FF4D4F',
  coralDeep: '#E03A3C',
  coralSoft: 'rgba(255, 77, 79, 0.14)',
  coralGlow: 'rgba(255, 77, 79, 0.35)',
  mint: '#2EE6A8',
  mintSoft: 'rgba(46, 230, 168, 0.14)',
  cyan: '#37C8F0',
  amber: '#FFB020',

  text: '#F3F6FA',
  textDim: '#9CAAB9',
  textFaint: '#67768A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(6, 9, 13, 0.72)',
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

/** reusable absolute fill object (StyleSheet.absoluteFillObject is gone in RN 0.88 types) */
export const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** top inset for screens (no safe-area dependency: good enough for all three platforms) */
export const safeTop = Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 30 : 18;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  glow: {
    shadowColor: colors.coral,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
} as const;

export const type = {
  display: { fontSize: 27, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '800' as const, letterSpacing: -0.4 },
  section: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.2 },
} as const;
