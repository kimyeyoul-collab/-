import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { absoluteFill, colors, radius, safeTop, shadow, space, type } from '../theme';
import { findSong } from '../data/mock';
import { useClock, useCountdown } from '../hooks/useClock';
import { useCameraStream } from '../hooks/useCameraStream';
import { modeForGenre, startSynth, SynthHandle } from '../audio/synth';
import { useStore } from '../store';
import { DEFAULT_SETTINGS } from '../types';
import { CloseIcon, MicIcon, PauseIcon, PlayIcon } from '../components/Icons';
import { EqualizerMini } from '../components/AudioBars';
import { formatTicks, formatTime, wrapPhrase } from '../utils/format';

type Phase = 'idle' | 'recording' | 'paused';

export function RecordingScreen({ songId }: { songId: string }) {
  const song = findSong(songId);
  const { back, navigate, setTake, showToast } = useStore();

  const clock = useClock(song.durationSec);
  const { count, start: startCountdown, stop: stopCountdown } = useCountdown();
  const camera = useCameraStream();
  const getMicLevel = camera.getLevel;

  const [phase, setPhase] = useState<Phase>('idle');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [level, setLevel] = useState(0.14);
  const synthRef = useRef<SynthHandle | null>(null);
  const blink = useRef(new Animated.Value(1)).current;

  /* ---- viewport size: keep a true 9:16 frame inside the available area ---- */
  const viewport = useMemo(() => {
    const width = Math.min(box.w, (box.h * 9) / 16);
    return { width: Math.max(0, width), height: Math.max(0, (width * 16) / 9) };
  }, [box]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  /* ------------------------------ blinking REC ----------------------------- */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 620, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  /* ---------------------------- vocal input level -------------------------- */
  useEffect(() => {
    if (phase !== 'recording') {
      setLevel(0.1);
      return;
    }
    const id = setInterval(() => {
      const real = getMicLevel();
      if (real > 0.03) {
        setLevel(real);
        return;
      }
      const t = Date.now() / 240;
      const simulated = 0.3 + Math.abs(Math.sin(t) * Math.cos(t * 0.53)) * 0.6;
      setLevel(simulated);
    }, 110);
    return () => clearInterval(id);
  }, [phase, getMicLevel]);

  /* ------------------------------- MR audio -------------------------------- */
  const stopMr = useCallback(() => {
    synthRef.current?.stop();
    synthRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === 'recording' && !synthRef.current) {
      synthRef.current = startSynth(modeForGenre(song.genre), song.bpm);
    }
    if (phase === 'idle') stopMr();
    return undefined;
  }, [phase, song.genre, song.bpm, stopMr]);

  useEffect(() => () => stopMr(), [stopMr]);

  useEffect(() => {
    if (clock.isFinished && phase === 'recording') {
      setPhase('paused');
      stopMr();
      showToast('커버 구간이 끝났어요. 녹음을 완료해 주세요');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.isFinished]);

  /* -------------------------------- actions -------------------------------- */
  const beginRecording = useCallback(() => {
    clock.reset();
    clock.play();
    setPhase('recording');
  }, [clock]);

  const handleStart = () => {
    if (phase === 'idle') {
      if (camera.status === 'idle') camera.request();
      startCountdown(3, beginRecording);
      return;
    }
    clock.play();
    setPhase('recording');
  };

  const handlePause = () => {
    clock.pause();
    setPhase('paused');
    stopMr();
  };

  const handleRetake = () => {
    stopCountdown();
    stopMr();
    clock.reset();
    setPhase('idle');
    showToast('녹음을 지우고 처음부터 다시 시작할게요');
  };

  const handleFinish = () => {
    clock.pause();
    stopMr();
    stopCountdown();
    setTake({
      songId: song.id,
      durationSec: clock.pos > 3 ? clock.pos : song.durationSec,
      settings: DEFAULT_SETTINGS,
      createdAt: Date.now(),
    });
    navigate({ name: 'result', songId: song.id }, { replace: true });
  };

  /* -------------------------------- lyrics -------------------------------- */
  const highlightIndex = useMemo(() => {
    const current = song.lyrics.findIndex(line => clock.pos >= line.start && clock.pos < line.end);
    if (current >= 0) return current;
    const upcoming = song.lyrics.findIndex(line => line.start > clock.pos);
    return upcoming >= 0 ? upcoming : song.lyrics.length - 1;
  }, [clock.pos, song.lyrics]);

  const visibleLyrics = useMemo(() => {
    const start = Math.max(0, highlightIndex - 1);
    return song.lyrics.slice(start, start + 3).map((line, offset) => ({
      line,
      index: start + offset,
    }));
  }, [highlightIndex, song.lyrics]);

  const activeLine = song.lyrics[highlightIndex];
  const lineProgress = activeLine
    ? Math.min(1, Math.max(0, (clock.pos - activeLine.start) / (activeLine.end - activeLine.start)))
    : 0;

  const recording = phase === 'recording';
  const progress = clock.pos / song.durationSec;
  const canFinish = clock.pos > 1.2;
  const showCameraButton = camera.status !== 'live';

  return (
    <View style={styles.root}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityLabel="촬영 취소" hitSlop={10} style={styles.headerButton}>
          <CloseIcon size={13} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{song.title}</Text>
          <Text style={styles.headerSub}>{song.artist} · 커버 촬영</Text>
        </View>
        <View style={styles.ratioBadge}>
          <Text style={styles.ratioText}>9:16</Text>
        </View>
      </View>

      {/* 9:16 viewport */}
      <View style={styles.stageArea} onLayout={onStageLayout}>
        {viewport.width > 0 ? (
          <View
            style={[
              styles.viewport,
              { width: viewport.width, height: viewport.height },
            ]}
          >
            {camera.status === 'live' ? (
              <View ref={camera.setContainerRef} style={StyleSheet.absoluteFill} />
            ) : (
              <MockCamera />
            )}

            {/* grid */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {[1 / 3, 2 / 3].map(r => (
                <View
                  key={`v${r}`}
                  style={{
                    position: 'absolute',
                    left: `${r * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                  }}
                />
              ))}
              {[1 / 3, 2 / 3].map(r => (
                <View
                  key={`h${r}`}
                  style={{
                    position: 'absolute',
                    top: `${r * 100}%`,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                  }}
                />
              ))}
            </View>

            {/* top overlay */}
            <View style={styles.topOverlay}>
              <View style={[styles.recPill, recording && styles.recPillLive]}>
                <Animated.View
                  style={[
                    styles.recDot,
                    { opacity: recording ? blink : 0.5, backgroundColor: recording ? colors.coral : colors.textFaint },
                  ]}
                />
                <Text style={[styles.recText, recording && { color: colors.text }]}>
                  {recording ? formatTicks(clock.pos) : phase === 'paused' ? 'PAUSE' : 'READY'}
                </Text>
              </View>
              <View style={styles.mrPill}>
                <EqualizerMini active={recording} color={recording ? colors.mint : colors.textFaint} />
                <Text style={styles.mrPillText}>MR</Text>
              </View>
            </View>

            {/* vocal input meter on the right edge */}
            <View style={styles.meterWrap} pointerEvents="none">
              <Text style={styles.meterLabel}>VOCAL</Text>
              <VocalVu level={level} />
            </View>

            {/* framing brackets */}
            <View pointerEvents="none" style={styles.brackets}>
              <View style={[styles.bracket, { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1, borderTopLeftRadius: 6 }]} />
              <View style={[styles.bracket, { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1, borderTopRightRadius: 6 }]} />
              <View style={[styles.bracket, { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1, borderBottomLeftRadius: 6 }]} />
              <View style={[styles.bracket, { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1, borderBottomRightRadius: 6 }]} />
            </View>

            {/* lyrics */}
            <View style={styles.lyricLayer} pointerEvents="none">
              <LinearGradient
                colors={['rgba(4,6,10,0)', 'rgba(4,6,10,0.55)', 'rgba(4,6,10,0.94)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ paddingHorizontal: 13, paddingBottom: 24, paddingTop: 44 }}>
                {visibleLyrics.map(({ line, index }) => {
                  const active = index === highlightIndex;
                  return (
                    <View key={`${line.start}-${index}`} style={{ marginBottom: active ? 7 : 5 }}>
                      {active ? (
                        wrapPhrase(line.text, 15).map((row, rowIndex) => (
                          <Text key={rowIndex} style={[styles.lyricText, styles.lyricTextActive]}>
                            {row}
                          </Text>
                        ))
                      ) : (
                        <Text numberOfLines={2} style={[styles.lyricText, styles.lyricTextIdle]}>
                          {line.text}
                        </Text>
                      )}
                      {active ? (
                        <View style={styles.lineTrack}>
                          <View style={[styles.lineFill, { width: `${lineProgress * 100}%` }]} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* camera permission / preview note */}
            <View style={styles.camSlot} pointerEvents="box-none">
              {showCameraButton ? (
                <Pressable
                  onPress={camera.request}
                  style={({ pressed }) => [styles.camButton, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.camButtonText}>
                    {camera.status === 'requesting'
                      ? '카메라 연결 중…'
                      : camera.status === 'denied'
                      ? '카메라 권한 없음 · 모의 프리뷰'
                      : camera.status === 'unsupported'
                      ? '모의 프리뷰 (카메라 미지원)'
                      : '전면 카메라 켜기'}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE CAM</Text>
                </View>
              )}
            </View>

            {/* countdown */}
            {count !== null ? (
              <View style={styles.countdown}>
                <Text style={styles.countdownNumber}>{count}</Text>
                <Text style={styles.countdownLabel}>곧 시작해요 · 준비하세요</Text>
              </View>
            ) : null}

          </View>
        ) : null}
      </View>

      {/* footer: progress + controls */}
      <View style={styles.footer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressTime}>{formatTime(clock.pos)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            <View style={[styles.progressThumb, { left: `${Math.min(100, progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressTime}>{formatTime(song.durationSec)}</Text>
        </View>

        <View style={styles.controls}>
          <ControlButton
            label="다시찍기"
            onPress={handleRetake}
            disabled={phase === 'idle' && clock.pos === 0}
            icon={<Text style={styles.retakeGlyph}>↺</Text>}
          />

          <Pressable
            onPress={recording ? handlePause : handleStart}
            style={({ pressed }) => [styles.mainButton, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            {recording ? (
              <PauseIcon size={16} color={colors.white} />
            ) : phase === 'paused' ? (
              <PlayIcon size={18} color={colors.white} />
            ) : (
              <MicIcon size={16} color={colors.white} />
            )}
            <Text style={styles.mainLabel}>
              {recording ? '일시정지' : phase === 'paused' ? '이어서 녹음' : '녹음 시작'}
            </Text>
          </Pressable>

          <ControlButton
            label="녹음 완료"
            onPress={handleFinish}
            disabled={!canFinish}
            tone="mint"
            icon={<Text style={styles.doneGlyph}>✓</Text>}
          />
        </View>

        <Text style={styles.hint}>
          {recording
            ? '박자에 맞춰 가사가 넘어가요 · 이어폰 착용을 권장해요'
            : phase === 'paused'
            ? '일시정지 상태예요. 이어서 녹음하거나 완료할 수 있어요'
            : '3초 카운트다운 후 MR과 함께 녹음이 시작됩니다'}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------ mock camera ------------------------------ */

function MockCamera() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#1B2430', '#101720', '#080C11']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.mockGlow} />
      <View style={styles.mockSubject}>
        <View style={styles.mockHead} />
        <View style={styles.mockShoulders} />
      </View>
      <View style={styles.mockRings}>
        {[132, 178, 224].map((size, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: -size / 2,
              marginLeft: -size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              opacity: 1 - i * 0.25,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function VocalVu({ level }: { level: number }) {
  const bars = 9;
  const lit = Math.max(0, Math.min(bars, Math.round(level * bars)));
  return (
    <View style={{ gap: 2.5, alignItems: 'flex-end' }}>
      {Array.from({ length: bars }, (_, i) => {
        const index = bars - 1 - i;
        const active = index < lit;
        return (
          <View
            key={i}
            style={{
              width: 12 + index * 0.9,
              height: 2.4,
              borderRadius: 2,
              backgroundColor: active ? colors.mint : 'rgba(255,255,255,0.14)',
              opacity: active ? 0.55 + (index / bars) * 0.45 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

/* ------------------------------ control button ---------------------------- */

function ControlButton({
  label,
  icon,
  onPress,
  disabled,
  tone = 'ghost',
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'ghost' | 'mint';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.control,
        tone === 'mint' && styles.controlMint,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      {icon}
      <Text style={[styles.controlLabel, tone === 'mint' && { color: colors.mint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: safeTop,
    paddingHorizontal: space(4),
    paddingBottom: space(2),
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...type.label, color: colors.text, fontSize: 13 },
  headerSub: { ...type.micro, color: colors.textFaint, marginTop: 2, fontWeight: '500' },
  ratioBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ratioText: { ...type.micro, color: colors.textDim, fontSize: 9.5 },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space(2) },
  viewport: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0B1016',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    ...shadow.card,
  },
  topOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,9,13,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recPillLive: { borderColor: 'rgba(255,77,79,0.5)' },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  recText: { ...type.micro, color: colors.textDim, fontSize: 9.5, letterSpacing: 0.4 },
  mrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,9,13,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mrPillText: { ...type.micro, color: colors.mint, fontSize: 9.5 },
  meterWrap: {
    position: 'absolute',
    right: 9,
    top: '33%',
    alignItems: 'flex-end',
    gap: 5,
  },
  meterLabel: { ...type.micro, color: colors.textFaint, fontSize: 8, letterSpacing: 1 },
  brackets: {
    position: 'absolute',
    top: '22%',
    bottom: '26%',
    left: '14%',
    right: '14%',
  },
  bracket: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  lyricLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  lyricText: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  lyricTextActive: { color: colors.white, fontSize: 14.5 },
  lyricTextIdle: { color: 'rgba(243,246,250,0.32)', fontWeight: '600' },
  lineTrack: {
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 6,
    overflow: 'hidden',
  },
  lineFill: { height: 2, borderRadius: 2, backgroundColor: colors.coral },
  camSlot: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  camButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,9,13,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  camButtonText: { ...type.micro, color: colors.textDim, fontSize: 9.5, fontWeight: '600' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(6,9,13,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.4)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.coral },
  liveText: { ...type.micro, color: colors.textDim, fontSize: 8, letterSpacing: 1 },
  countdown: {
    ...absoluteFill,
    backgroundColor: 'rgba(4,6,10,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  countdownNumber: { fontSize: 76, fontWeight: '900', color: colors.coral },
  countdownLabel: { ...type.label, color: colors.textDim, fontSize: 12 },
  mockGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: 'rgba(255,77,79,0.10)',
    top: -60,
    right: -80,
  },
  mockSubject: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  mockHead: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mockShoulders: {
    width: 136,
    height: 78,
    borderTopLeftRadius: 68,
    borderTopRightRadius: 68,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.07)',
    marginTop: 8,
  },
  mockRings: {
    ...absoluteFill,
  },
  footer: {
    paddingHorizontal: space(5),
    paddingTop: space(2),
    paddingBottom: space(5),
    gap: space(3),
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTime: { ...type.micro, color: colors.textFaint, fontSize: 10, width: 32 },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceHi,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 4, backgroundColor: colors.coral },
  progressThumb: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    marginLeft: -5,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  control: {
    width: 68,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  controlMint: { borderColor: 'rgba(46,230,168,0.35)', backgroundColor: colors.mintSoft },
  controlLabel: { ...type.micro, color: colors.textDim, fontSize: 9.5, fontWeight: '600' },
  retakeGlyph: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  doneGlyph: { color: colors.mint, fontSize: 14, fontWeight: '900' },
  mainButton: {
    flex: 1,
    marginHorizontal: space(3),
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.glow,
  },
  mainLabel: { ...type.label, color: colors.white, fontSize: 13.5, fontWeight: '700' },
  hint: { ...type.micro, color: colors.textFaint, textAlign: 'center', fontSize: 10, fontWeight: '500' },
});
