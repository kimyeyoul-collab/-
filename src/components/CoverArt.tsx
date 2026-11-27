import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NoteGlyph } from './Icons';
import { absoluteFill, colors } from '../theme';

interface Props {
  cover: [string, string];
  size?: number;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  glyphSize?: number;
  /** overlay a vertical dark scrim, useful behind text */
  scrim?: boolean;
}

/** Gradient artwork stand-in for MR cover images (no assets needed for the MVP). */
export function CoverArt({ cover, size = 56, style, radius = 14, glyphSize, scrim }: Props) {
  const g = glyphSize ?? size * 0.3;
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[cover[0], cover[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.95,
          height: size * 0.95,
          borderRadius: size,
          backgroundColor: 'rgba(255,255,255,0.06)',
          top: -size * 0.34,
          right: -size * 0.24,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size,
          backgroundColor: 'rgba(255,77,79,0.18)',
          bottom: -size * 0.2,
          left: -size * 0.12,
        }}
      />
      {scrim ? (
        <LinearGradient
          colors={['rgba(8,11,16,0)', 'rgba(8,11,16,0.85)']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.center}>
        <NoteGlyph size={g} color="rgba(255,255,255,0.62)" />
      </View>
      <View
        style={[
          absoluteFill,
          { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...absoluteFill, alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: colors.surfaceAlt },
});
