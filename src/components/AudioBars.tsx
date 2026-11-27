import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Static-ish waveform used under the MR preview player; the played part is accent. */
export function MrWaveform({
  progress,
  bars = 46,
  height = 34,
  color = colors.coral,
  muted = colors.surfaceHi,
}: {
  progress: number;
  bars?: number;
  height?: number;
  color?: string;
  muted?: string;
}) {
  const values = Array.from({ length: bars }, (_, i) => {
    const n = Math.sin(i * 1.27) * Math.cos(i * 0.41) + Math.sin(i * 0.13) * 0.6;
    return 0.28 + Math.abs(n) * 0.72;
  });
  return (
    <View style={[styles.row, { height }]}>
      {values.map((value, index) => {
        const played = index / bars <= progress;
        return (
          <View
            key={index}
            style={{
              flex: 1,
              height: Math.max(3, value * height),
              borderRadius: 2,
              backgroundColor: played ? color : muted,
              opacity: played ? 0.95 : 0.65,
            }}
          />
        );
      })}
    </View>
  );
}

/** Live vocal input meter — bars react to the (mock) input level. */
export function VocalBars({
  level,
  phase = 0,
  bars = 22,
  height = 40,
  color = colors.mint,
}: {
  level: number;
  phase?: number;
  bars?: number;
  height?: number;
  color?: string;
}) {
  return (
    <View style={[styles.row, { height }]}>
      {Array.from({ length: bars }, (_, index) => {
        const wave = Math.abs(Math.sin(index * 0.9 + phase * 0.9));
        const center = 1 - Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2);
        const value = 0.12 + level * wave * (0.45 + center * 0.75);
        return (
          <View
            key={index}
            style={{
              flex: 1,
              height: Math.max(2, Math.min(1, value) * height),
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.35 + Math.min(0.65, value),
            }}
          />
        );
      })}
    </View>
  );
}

/** Decorative equalizer for cards / the result preview. */
export function EqualizerMini({ active = true, color = colors.mint }: { active?: boolean; color?: string }) {
  return (
    <View style={[styles.row, { height: 14, width: 22 }]}>
      {[0.5, 1, 0.7].map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 14 * (active ? v : 0.35),
            borderRadius: 1.5,
            backgroundColor: active ? color : colors.textFaint,
            opacity: 0.9,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
