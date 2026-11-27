import React, { useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { clamp } from '../utils/format';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  accent?: string;
  /** fills from 0 (default) or from the middle value */
  bipolar?: boolean;
  trackHeight?: number;
  thumbSize?: number;
}

/**
 * Cross-platform range slider built on PanResponder so it works identically on
 * iOS, Android and react-native-web without any native module.
 */
export function RangeSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  accent = colors.coral,
  bipolar = false,
  trackHeight = 6,
  thumbSize = 18,
}: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startRatioRef = useRef(0);

  const config = useRef({ value, min, max, step, onChange });
  config.current = { value, min, max, step, onChange };

  const applyRatio = useCallback((ratio: number) => {
    const { min: lo, max: hi, step: st, onChange: cb } = config.current;
    const raw = lo + clamp(ratio, 0, 1) * (hi - lo);
    const stepped = st > 0 ? Math.round(raw / st) * st : raw;
    const next = clamp(stepped, lo, hi);
    if (next !== config.current.value) cb(next);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: event => {
        const w = widthRef.current || 1;
        const local = event.nativeEvent.locationX ?? 0;
        const ratio = clamp(local / w, 0, 1);
        startRatioRef.current = ratio;
        applyRatio(ratio);
      },
      onPanResponderMove: (_event, gesture) => {
        const w = widthRef.current || 1;
        applyRatio(startRatioRef.current + gesture.dx / w);
      },
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const ratio = clamp((value - min) / (max - min || 1), 0, 1);
  const thumbX = ratio * width;
  const zeroRatio = bipolar ? clamp((0 - min) / (max - min || 1), 0, 1) : 0;
  const fillLeft = Math.min(thumbX, zeroRatio * width);
  const fillWidth = Math.abs(thumbX - zeroRatio * width);

  return (
    <View style={styles.wrap} onLayout={onLayout} {...pan.panHandlers}>
      <View style={[styles.track, { height: trackHeight, borderRadius: trackHeight }]}>
        <View
          style={{
            position: 'absolute',
            left: fillLeft,
            width: Math.max(fillWidth, 2),
            height: trackHeight,
            borderRadius: trackHeight,
            backgroundColor: accent,
          }}
        />
        {bipolar && width > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: zeroRatio * width - 0.75,
              width: 1.5,
              height: trackHeight + 6,
              top: -3,
              backgroundColor: colors.borderStrong,
            }}
          />
        ) : null}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize,
            left: Math.max(0, Math.min(width - thumbSize, thumbX - thumbSize / 2)),
            top: (34 - thumbSize) / 2,
            borderColor: accent,
          },
        ]}
      >
        <View style={{ width: thumbSize * 0.3, height: thumbSize * 0.3, borderRadius: thumbSize, backgroundColor: accent }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 34,
    justifyContent: 'center',
    // extra hit area for thumbs
    paddingVertical: 6,
  },
  track: {
    backgroundColor: colors.surfaceHi,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: colors.bg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
