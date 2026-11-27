import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, type } from '../theme';
import { CheckIcon } from './Icons';

interface Props {
  message: string | null;
  tone: 'ok' | 'alert';
  onHide: () => void;
  /** bump to replay the animation */
  toastKey: number;
}

export function Toast({ message, tone, onHide, toastKey }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timeout = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onHide();
      });
    }, 2400);
    return () => clearTimeout(timeout);
  }, [message, toastKey, anim, onHide]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.toast, tone === 'alert' ? styles.alert : styles.ok]}>
        <View style={[styles.mark, { backgroundColor: tone === 'alert' ? colors.coral : colors.mint }]}>
          {tone === 'alert' ? <Text style={styles.markText}>!</Text> : <CheckIcon size={10} color={colors.bg} />}
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 90,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '88%',
  },
  ok: { backgroundColor: '#101C19', borderColor: 'rgba(46,230,168,0.35)' },
  alert: { backgroundColor: '#1C1012', borderColor: 'rgba(255,77,79,0.4)' },
  mark: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.bg, fontWeight: '900', fontSize: 11 },
  message: { ...type.label, color: colors.text, fontSize: 12.5, flexShrink: 1 },
});
