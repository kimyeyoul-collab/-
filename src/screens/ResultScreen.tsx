import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { absoluteFill, colors, radius, safeTop, shadow, space, type } from '../theme';
import { findSong } from '../data/mock';
import { useStore } from '../store';
import { DEFAULT_SETTINGS, TakeSettings } from '../types';
import { useClock } from '../hooks/useClock';
import { CoverArt } from '../components/CoverArt';
import { RangeSlider } from '../components/RangeSlider';
import { TopBar } from '../components/TopBar';
import { Badge, Card, Chip, GhostButton, IconButton, PrimaryButton } from '../components/ui';
import { CheckIcon, NoteGlyph, PauseIcon, PlayIcon, CloseIcon } from '../components/Icons';
import { formatTime, wrapPhrase } from '../utils/format';

type Preset = { key: string; label: string; values: TakeSettings };

const PRESETS: Preset[] = [
  { key: 'pop', label: '팝 클린', values: { vocal: 86, mr: 62, echo: 14, reverb: 20, syncMs: 0 } },
  { key: 'ballad', label: '발라드', values: { vocal: 80, mr: 66, echo: 30, reverb: 46, syncMs: 0 } },
  { key: 'live', label: '라이브', values: { vocal: 90, mr: 74, echo: 12, reverb: 16, syncMs: -40 } },
  { key: 'aca', label: '아카펠라', values: { vocal: 96, mr: 24, echo: 22, reverb: 58, syncMs: 0 } },
];

const STEPS = ['오디오 믹싱', '영상 인코딩', '자막 합성', '썸네일 생성', '마무리 중'];

export function ResultScreen({ songId }: { songId: string }) {
  const song = findSong(songId);
  const { back, navigate, take, showToast } = useStore();
  const clock = useClock(song.durationSec);

  const [settings, setSettings] = useState<TakeSettings>(take?.settings ?? DEFAULT_SETTINGS);
  const [preset, setPreset] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* auto preview so the 9:16 frame feels alive on arrival */
  useEffect(() => {
    const id = setTimeout(() => clock.play(), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const activeIndex = useMemo(() => {
    const current = song.lyrics.findIndex(line => clock.pos >= line.start && clock.pos < line.end);
    if (current >= 0) return current;
    const next = song.lyrics.findIndex(line => line.start > clock.pos);
    return next >= 0 ? next : song.lyrics.length - 1;
  }, [clock.pos, song.lyrics]);

  const activeLine = song.lyrics[activeIndex];
  const nextLine = song.lyrics[activeIndex + 1];

  const update = (patch: Partial<TakeSettings>) => {
    setSettings(current => ({ ...current, ...patch }));
    setPreset(null);
  };

  const startGeneration = () => {
    if (generating) return;
    setModalOpen(true);
    setGenerating(true);
    setGenerated(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress(current => {
        const next = Math.min(100, current + 2 + Math.random() * 4);
        if (next >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setGenerating(false);
          setGenerated(true);
          showToast('커버 영상이 완성됐어요');
        }
        return next;
      });
    }, 70);
  };

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: safeTop }}>
        <TopBar
          onBack={back}
          title="결과물 편집"
          subtitle={`${song.title} · ${song.artist}`}
          right={
            <IconButton size={34} onPress={() => showToast('공유 링크를 복사했어요 (데모)')}>
              <Text style={{ fontSize: 13, color: colors.textDim }}>↗</Text>
            </IconButton>
          }
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 9:16 preview */}
        <View style={styles.previewWrap}>
          <View style={styles.preview}>
            <LinearGradient
              colors={[song.cover[0], song.cover[1], '#05070A']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.previewGlow} />
            <View style={styles.previewGlow2} />
            <View style={styles.previewNotes}>
              <NoteGlyph size={26} color="rgba(255,255,255,0.10)" />
              <NoteGlyph size={16} color="rgba(255,255,255,0.07)" />
            </View>

            <View style={styles.previewTop}>
              <Badge label="COVER" tone="coral" />
              <Text style={styles.previewSpec}>1080×1920</Text>
            </View>

            <View style={styles.previewCenter}>
              {!clock.playing ? (
                <Pressable onPress={clock.play} style={styles.centerPlay}>
                  <PlayIcon size={20} color={colors.white} />
                </Pressable>
              ) : (
                <Pressable onPress={clock.pause} style={styles.centerPlayGhost}>
                  <PauseIcon size={14} color={colors.white} />
                </Pressable>
              )}
            </View>

            <LinearGradient
              colors={['rgba(4,6,10,0)', 'rgba(4,6,10,0.75)', 'rgba(4,6,10,0.95)']}
              style={styles.subtitleScrim}
            />
            <View style={styles.subtitleBox}>
              {wrapPhrase(activeLine?.text ?? '', 12).map((row, index) => (
                <Text key={index} style={styles.subtitleMain}>
                  {row}
                </Text>
              ))}
              <Text style={styles.subtitleNext} numberOfLines={1}>
                {nextLine?.text ?? ' '}
              </Text>
              <View style={styles.subtitleBar}>
                <View style={styles.subtitleBarFill} />
              </View>
            </View>

            <View style={styles.previewBottom}>
              <View style={styles.previewSongRow}>
                <CoverArt cover={song.cover} size={30} radius={8} glyphSize={11} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewSongTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.previewSongArtist} numberOfLines={1}>
                    {song.artist} · cover by 예율
                  </Text>
                </View>
                <Text style={styles.previewTime}>{formatTime(clock.pos)}</Text>
              </View>
              <View style={styles.previewTrack}>
                <View
                  style={[styles.previewTrackFill, { width: `${(clock.pos / song.durationSec) * 100}%` }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.previewSide}>
            <Text style={styles.previewSideLabel}>TAKE 01</Text>
            <Text style={styles.previewSideValue}>{formatTime(take?.durationSec ?? song.durationSec)}</Text>
            <View style={styles.previewSideDivider} />
            <Text style={styles.previewSideLabel}>MIX</Text>
            <Text style={styles.previewSideValue}>
              {settings.vocal}/{settings.mr}
            </Text>
            <View style={styles.previewSideDivider} />
            <Text style={styles.previewSideLabel}>SYNC</Text>
            <Text style={styles.previewSideValue}>
              {settings.syncMs > 0 ? '+' : ''}
              {settings.syncMs}ms
            </Text>
          </View>
        </View>

        {/* transport */}
        <View style={styles.transport}>
          <IconButton
            onPress={clock.toggle}
            accessibilityLabel={clock.playing ? '미리보기 일시정지' : '미리보기 재생'}
            size={40}
            style={{ backgroundColor: colors.coral }}
          >
            {clock.playing ? <PauseIcon size={12} color={colors.white} /> : <PlayIcon size={13} color={colors.white} />}
          </IconButton>
          <View style={{ flex: 1 }}>
            <RangeSlider
              value={clock.pos}
              min={0}
              max={song.durationSec}
              step={0.5}
              accent={colors.coral}
              onChange={clock.seek}
              trackHeight={4}
              thumbSize={12}
            />
          </View>
          <Text style={styles.transportTime}>
            {formatTime(clock.pos)} / {formatTime(song.durationSec)}
          </Text>
        </View>

        {/* mix balance */}
        <Card style={{ marginTop: space(4) }}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>믹스 밸런스</Text>
            <Badge label="실시간 반영" tone="mint" dot />
          </View>
          <View style={styles.mixRow}>
            <Text style={styles.mixLabel}>VOCAL</Text>
            <View style={styles.mixTrack}>
              <View style={[styles.mixVocal, { flex: Math.max(1, settings.vocal) }]} />
              <View style={[styles.mixMr, { flex: Math.max(1, settings.mr) }]} />
            </View>
            <Text style={styles.mixLabel}>MR</Text>
          </View>
          <View style={styles.mixLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
            <Text style={styles.legendText}>보컬 {settings.vocal}%</Text>
            <View style={[styles.legendDot, { backgroundColor: colors.mint }]} />
            <Text style={styles.legendText}>MR {settings.mr}%</Text>
          </View>
        </Card>

        {/* editor */}
        <View style={{ marginTop: space(5) }}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>오디오 편집</Text>
            <Pressable onPress={() => { setSettings(DEFAULT_SETTINGS); setPreset(null); }}>
              <Text style={styles.resetLink}>초기화</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {PRESETS.map(item => (
              <Chip
                key={item.key}
                label={item.label}
                compact
                active={preset === item.key}
                onPress={() => {
                  setSettings(item.values);
                  setPreset(item.key);
                  showToast(`${item.label} 프리셋을 적용했어요`);
                }}
              />
            ))}
          </ScrollView>

          <Card style={{ marginTop: space(3) }}>
            <SliderRow
              label="보컬 음량"
              hint="내 목소리"
              value={settings.vocal}
              min={0}
              max={100}
              onChange={value => update({ vocal: value })}
              accent={colors.coral}
              display={`${settings.vocal}%`}
            />
            <SliderRow
              label="MR 음량"
              hint="반주"
              value={settings.mr}
              min={0}
              max={100}
              onChange={value => update({ mr: value })}
              accent={colors.mint}
              display={`${settings.mr}%`}
            />
            <SliderRow
              label="Echo"
              hint="메아리"
              value={settings.echo}
              min={0}
              max={100}
              onChange={value => update({ echo: value })}
              accent={colors.cyan}
              display={`${settings.echo}%`}
            />
            <SliderRow
              label="Reverb"
              hint="공간감"
              value={settings.reverb}
              min={0}
              max={100}
              onChange={value => update({ reverb: value })}
              accent={colors.amber}
              display={`${settings.reverb}%`}
            />
            <SliderRow
              last
              bipolar
              label="영상-음원 싱크"
              hint="-500 ~ +500ms"
              value={settings.syncMs}
              min={-500}
              max={500}
              step={10}
              onChange={value => update({ syncMs: value })}
              accent={colors.coral}
              display={`${settings.syncMs > 0 ? '+' : ''}${settings.syncMs}ms`}
            />
            <View style={styles.syncHint}>
              <Text style={styles.syncHintText}>
                영상이 음원보다 늦으면 +, 빠르면 −로 조정하세요 · 10ms 단위
              </Text>
            </View>
          </Card>
        </View>

        {/* export info */}
        <Card style={{ marginTop: space(4) }}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>출력 설정</Text>
            <Badge label="9:16 세로" tone="coral" />
          </View>
          <View style={styles.specGrid}>
            {[
              { label: '해상도', value: '1080 × 1920' },
              { label: '프레임', value: '30fps' },
              { label: '길이', value: formatTime(take?.durationSec ?? song.durationSec) },
              { label: '용량', value: '약 24.6MB' },
            ].map(item => (
              <View key={item.label} style={styles.specCell}>
                <Text style={styles.specLabel}>{item.label}</Text>
                <Text style={styles.specValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ height: 116 }} />
      </ScrollView>

      {/* footer */}
      <View style={styles.footer}>
        <GhostButton
          label="다시 찍기"
          onPress={() => navigate({ name: 'recording', songId: song.id }, { replace: true })}
          style={{ flex: 0.8 }}
        />
        <PrimaryButton
          label={generated ? '저장 · 공유하기' : '최종 영상 생성'}
          onPress={generated ? () => setModalOpen(true) : startGeneration}
          style={{ flex: 1.4 }}
        />
      </View>

      {/* generation modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setModalOpen(false)}
              accessibilityLabel="닫기"
              style={styles.modalClose}
              hitSlop={10}
            >
              <CloseIcon size={12} color={colors.textDim} />
            </Pressable>

            {!generated ? (
              <>
                <View style={styles.modalIcon}>
                  <ActivityIndicator color={colors.coral} />
                </View>
                <Text style={styles.modalTitle}>커버 영상을 만들고 있어요</Text>
                <Text style={styles.modalCaption}>
                  {STEPS[stepIndex]} · {Math.round(progress)}%
                </Text>
                <View style={styles.modalTrack}>
                  <View style={[styles.modalFill, { width: `${progress}%` }]} />
                </View>
                <View style={styles.modalSteps}>
                  {STEPS.map((label, index) => (
                    <View key={label} style={styles.modalStepRow}>
                      <View
                        style={[
                          styles.modalStepDot,
                          index < stepIndex && { backgroundColor: colors.mint },
                          index === stepIndex && { backgroundColor: colors.coral },
                        ]}
                      />
                      <Text
                        style={[
                          styles.modalStepText,
                          index <= stepIndex && { color: colors.textDim },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={[styles.modalIcon, { backgroundColor: colors.mintSoft, borderColor: 'rgba(46,230,168,0.4)' }]}>
                  <CheckIcon size={20} color={colors.mint} />
                </View>
                <Text style={styles.modalTitle}>커버 영상이 완성됐어요</Text>
                <Text style={styles.modalCaption}>1080×1920 · 9:16 · {formatTime(take?.durationSec ?? song.durationSec)} · 24.6MB</Text>

                <View style={styles.shareGrid}>
                  <PrimaryButton
                    label="기기에 저장"
                    onPress={() => showToast('갤러리에 저장했어요 (데모)')}
                    style={{ flex: 1 }}
                  />
                  <GhostButton
                    label="링크 복사"
                    onPress={() => showToast('공유 링크를 복사했어요 (데모)')}
                    style={{ flex: 1 }}
                  />
                </View>

                <Text style={styles.shareTitle}>SNS 공유</Text>
                <View style={styles.snsRow}>
                  {[
                    { label: 'YouTube Shorts', tone: '#FF4D4F' },
                    { label: 'Instagram Reels', tone: '#37C8F0' },
                  ].map(item => (
                    <Pressable
                      key={item.label}
                      onPress={() => showToast(`${item.label} 업로드 화면으로 이동할게요 (데모)`)}
                      style={({ pressed }) => [styles.snsButton, pressed && { opacity: 0.8 }]}
                    >
                      <View style={[styles.snsDot, { backgroundColor: item.tone }]} />
                      <Text style={styles.snsLabel}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.modalFootnote}>
                  실제 업로드는 계정 연동 후 지원될 예정이에요
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
  accent,
  display,
  bipolar,
  last,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accent: string;
  display: string;
  bipolar?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.sliderRow, last && { marginBottom: 0 }]}>
      <View style={styles.sliderHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.sliderDot, { backgroundColor: accent }]} />
          <Text style={styles.sliderLabel}>{label}</Text>
          {hint ? <Text style={styles.sliderHint}>{hint}</Text> : null}
        </View>
        <Text style={[styles.sliderValue, { color: accent }]}>{display}</Text>
      </View>
      <RangeSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        accent={accent}
        bipolar={bipolar}
        trackHeight={5}
        thumbSize={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space(5), paddingBottom: 24 },
  previewWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  preview: {
    width: 196,
    height: (196 * 16) / 9,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadow.card,
  },
  previewGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(255,77,79,0.16)',
    top: -50,
    right: -60,
  },
  previewGlow2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: 'rgba(55,200,240,0.10)',
    bottom: 30,
    left: -60,
  },
  previewNotes: { position: 'absolute', top: '30%', left: 18, gap: 10 },
  previewTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewSpec: { ...type.micro, color: 'rgba(255,255,255,0.5)', fontSize: 8.5 },
  previewCenter: { ...absoluteFill, alignItems: 'center', justifyContent: 'center' },
  centerPlay: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,77,79,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
  centerPlayGhost: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(6,9,13,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  subtitleBox: { position: 'absolute', left: 10, right: 10, bottom: 64, alignItems: 'center' },
  subtitleMain: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  subtitleNext: {
    color: 'rgba(243,246,250,0.38)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitleBar: {
    width: 46,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 10,
    overflow: 'hidden',
  },
  subtitleBarFill: { width: '62%', height: 2, borderRadius: 2, backgroundColor: colors.coral },
  previewBottom: { position: 'absolute', left: 12, right: 12, bottom: 18, gap: 8 },
  previewSongRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewSongTitle: { ...type.micro, color: colors.text, fontSize: 10 },
  previewSongArtist: { ...type.micro, color: 'rgba(243,246,250,0.45)', fontSize: 8, fontWeight: '500' },
  previewTime: { ...type.micro, color: 'rgba(243,246,250,0.6)', fontSize: 8.5 },
  previewTrack: { height: 2.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  previewTrackFill: { height: 2.5, borderRadius: 3, backgroundColor: colors.coral },
  previewSide: {
    width: 88,
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewSideLabel: { ...type.micro, color: colors.textFaint, fontSize: 8, letterSpacing: 0.6 },
  previewSideValue: { ...type.label, color: colors.text, fontSize: 12 },
  previewSideDivider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space(3) },
  transportTime: { ...type.micro, color: colors.textFaint, fontSize: 9.5, width: 62, textAlign: 'right' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  cardTitle: { ...type.label, color: colors.text, fontSize: 13 },
  sectionTitle: { ...type.section, color: colors.text, marginBottom: space(2) },
  resetLink: { ...type.micro, color: colors.textFaint, fontWeight: '600' },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  mixLabel: { ...type.micro, color: colors.textFaint, fontSize: 8.5, width: 34 },
  mixTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  mixVocal: { backgroundColor: colors.coral, borderRadius: 5 },
  mixMr: { backgroundColor: colors.mint, borderRadius: 5 },
  mixLegend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { ...type.micro, color: colors.textDim, fontSize: 9.5, marginRight: 8, fontWeight: '500' },
  presetRow: { gap: 7, paddingRight: space(2) },
  sliderRow: { marginBottom: space(3) },
  sliderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sliderDot: { width: 6, height: 6, borderRadius: 3 },
  sliderLabel: { ...type.label, color: colors.text, fontSize: 12.5 },
  sliderHint: { ...type.micro, color: colors.textFaint, fontSize: 9.5, fontWeight: '500' },
  sliderValue: { ...type.label, fontSize: 12, fontWeight: '700' },
  syncHint: { marginTop: -4 },
  syncHintText: { ...type.micro, color: colors.textFaint, fontSize: 9, fontWeight: '500', lineHeight: 13 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  specCell: { width: '50%', paddingVertical: 7 },
  specLabel: { ...type.micro, color: colors.textFaint, fontSize: 9.5, fontWeight: '500' },
  specValue: { ...type.label, color: colors.text, fontSize: 12, marginTop: 3 },
  footer: {
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(5),
    paddingTop: space(3),
    paddingBottom: space(5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(8,11,16,0.96)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,10,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(5),
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(6),
    alignItems: 'center',
    ...shadow.card,
  },
  modalClose: { position: 'absolute', top: 14, right: 14, padding: 6 },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.coralSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(3),
  },
  modalTitle: { ...type.section, fontSize: 16, color: colors.text, textAlign: 'center' },
  modalCaption: { ...type.micro, color: colors.textDim, marginTop: 6, textAlign: 'center', fontWeight: '500' },
  modalTrack: {
    width: '100%',
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceHi,
    marginTop: space(4),
    overflow: 'hidden',
  },
  modalFill: { height: 6, borderRadius: 6, backgroundColor: colors.coral },
  modalSteps: { width: '100%', marginTop: space(3), gap: 6 },
  modalStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalStepDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.surfaceHi },
  modalStepText: { ...type.micro, color: colors.textFaint, fontSize: 10, fontWeight: '500' },
  shareGrid: { flexDirection: 'row', gap: space(2), marginTop: space(4), width: '100%' },
  shareTitle: { ...type.micro, color: colors.textFaint, alignSelf: 'flex-start', marginTop: space(4), fontSize: 10 },
  snsRow: { flexDirection: 'row', gap: space(2), marginTop: 8, width: '100%' },
  snsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  snsDot: { width: 6, height: 6, borderRadius: 3 },
  snsLabel: { ...type.micro, color: colors.text, fontSize: 10 },
  modalFootnote: { ...type.micro, color: colors.textFaint, marginTop: space(3), fontSize: 9, textAlign: 'center', fontWeight: '500' },
});
