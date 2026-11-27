import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

interface IconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const PlayIcon = ({ size = 12, color = colors.white, style }: IconProps) => (
  <View
    style={[
      {
        width: 0,
        height: 0,
        borderTopWidth: size * 0.58,
        borderBottomWidth: size * 0.58,
        borderLeftWidth: size * 0.92,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        marginLeft: size * 0.14,
      },
      style,
    ]}
  />
);

export const PauseIcon = ({ size = 12, color = colors.white, style }: IconProps) => (
  <View style={[{ flexDirection: 'row', gap: size * 0.32 }, style]}>
    {[0, 1].map(i => (
      <View
        key={i}
        style={{ width: size * 0.3, height: size * 1.15, borderRadius: 2, backgroundColor: color }}
      />
    ))}
  </View>
);

export const ChevronLeft = ({ size = 12, color = colors.text, style }: IconProps) => (
  <View
    style={[
      {
        width: size * 0.75,
        height: size * 0.75,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: size * 0.2,
      },
      style,
    ]}
  />
);

export const ChevronRight = ({ size = 12, color = colors.textDim, style }: IconProps) => (
  <View
    style={[
      {
        width: size * 0.7,
        height: size * 0.7,
        borderRightWidth: 2,
        borderTopWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      },
      style,
    ]}
  />
);

export const CloseIcon = ({ size = 12, color = colors.text, style }: IconProps) => (
  <View style={[{ width: size, height: size, justifyContent: 'center' }, style]}>
    <View
      style={{
        position: 'absolute',
        width: size,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const SearchIcon = ({ size = 14, color = colors.textFaint, style }: IconProps) => (
  <View style={[{ width: size, height: size, justifyContent: 'center' }, style]}>
    <View
      style={{
        width: size * 0.72,
        height: size * 0.72,
        borderRadius: size,
        borderWidth: 1.8,
        borderColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        right: -1,
        bottom: 0,
        width: size * 0.42,
        height: 1.8,
        borderRadius: 1,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

export const CheckIcon = ({ size = 12, color = colors.bg, style }: IconProps) => (
  <View
    style={[
      {
        width: size,
        height: size * 0.55,
        borderLeftWidth: 2.2,
        borderBottomWidth: 2.2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
        marginTop: -size * 0.15,
      },
      style,
    ]}
  />
);

export const PlusIcon = ({ size = 12, color = colors.bg, style }: IconProps) => (
  <View style={[{ width: size, height: size, justifyContent: 'center' }, style]}>
    <View style={{ position: 'absolute', width: size, height: 2, borderRadius: 1, backgroundColor: color }} />
    <View style={{ position: 'absolute', width: 2, height: size, borderRadius: 1, backgroundColor: color }} />
  </View>
);

export const ArrowUpIcon = ({ size = 12, color = colors.text, style }: IconProps) => (
  <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.38,
        borderRightWidth: size * 0.38,
        borderBottomWidth: size * 0.5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        marginBottom: size * 0.34,
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        width: 2,
        height: size * 0.62,
        borderRadius: 1,
        backgroundColor: color,
      }}
    />
  </View>
);

export const MicIcon = ({ size = 14, color = colors.text, style }: IconProps) => (
  <View style={[{ width: size, height: size * 1.2, alignItems: 'center' }, style]}>
    <View
      style={{
        width: size * 0.55,
        height: size * 0.72,
        borderRadius: size * 0.4,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.85,
        height: size * 0.62,
        borderBottomLeftRadius: size * 0.5,
        borderBottomRightRadius: size * 0.5,
        borderWidth: 1.6,
        borderTopWidth: 0,
        borderColor: color,
        marginTop: -size * 0.28,
      }}
    />
    <View style={{ width: 1.6, height: size * 0.16, backgroundColor: color }} />
  </View>
);

export const Dot = ({ size = 6, color = colors.coral }: IconProps) => (
  <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
);

export const Logo = ({ size = 30 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.32,
      backgroundColor: colors.coral,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: size * 0.08,
    }}
  >
    {[0.42, 0.72, 0.52].map((h, i) => (
      <View
        key={i}
        style={{
          width: size * 0.1,
          height: size * h,
          borderRadius: size * 0.05,
          backgroundColor: colors.white,
        }}
      />
    ))}
  </View>
);

export const NoteGlyph = ({ size = 18, color = 'rgba(255,255,255,0.7)' }: IconProps) => (
  <Text style={[styles.note, { fontSize: size, color }]}>♪</Text>
);

const styles = StyleSheet.create({
  note: { fontWeight: '700' },
});
