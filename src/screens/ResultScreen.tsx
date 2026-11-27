import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useStore } from '../store';
import { DEFAULT_SETTINGS, TakeSettings } from '../types';
import { CoverArt } from '../components/CoverArt';
import { RangeSlider } from '../components/RangeSlider';
import { TopBar } from '../components/TopBar';
import { Badge, Card, Chip, GhostButton, IconButton, PrimaryButton } from '../components/ui';
import { CheckIcon, NoteGlyph, PauseIcon, PlayIcon, CloseIcon } from '../components/Icons';
import { formatTime, wrapPhrase } from '../utils/format';
import { createTakeMixer, TakeMixer } from '../audio/mixer';
import { syncOffsetSec } from '../audio/webaudio';
import { downloadVideo, exportCoverVideo, shareVideo } from '../media/exportVideo';

type Preset = { key: string; label: string; values: TakeSettings };

const PRESETS: Preset[] = [
  { key: 'pop', label: '팝 클린', values: { vocal: 86, mr: 62, echo: 14, reverb: 20, syncMs: 0 } },
  { key: 'ballad', label: '발라드', values: { vocal: 80, mr: 66, echo: 30, reverb: 46, syncMs: 0 } },
  { key: 'live', label: '라이브', values: { vocal: 90, mr: 74, echo: 12, reverb: 16, syncMs: -40 } },
  { key: 'aca', label: '아카펠라', values: { vocal: 96, mr: 24, echo: 22, reverb: 58, syncMs: 0 } },
];

interface ExportedVideo {
  url: string;
  blob: any;
  mime: string;
  extension: 'mp4' | 'webm';
  size: number;
  width: number;
  height: number;
}

export function ResultScreen({ songId }: { songId: string }) {
  const { back, navigate, take, showToast, getSong } = useStore();
  const song = getSong(songId);
  const duration = Math.max(1, take?.durationSec ?? song.durationSec);
  const hasVideo = Boolean(take?.videoUrl);

  const [settings, setSettings] = useState<TakeSettings>(take?.settings ?? DEFAULT_SETTINGS);
  const [preset, setPreset] = useState<string | null>(null);

  const mixerRef = useRef<TakeMixer | null>(null);
  const videoNodeRef = useRef<any>(null);
  const [stageNode, setStageNode] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [exported, setExported] = useState<ExportedVideo | null>(null);
  const cancelRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setStageRef = useCallback((node: any) => setStageNode(node ?? null), []);

  /* real <video> stage showing the recorded take (mirrored like the preview) */
  useEffect(() => {
    const doc = (globalThis as unknown as Record<string, any>).document;
    if (!stageNode || !doc) return;
    let video = videoNodeRef.current;
    if (!video) {
      video = doc.createElement('video');
      video.setAttribute('playsinline', 'playsinline');
      video.setAttribute('muted', 'muted');
      video.muted = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.transform = 'scaleX(-1)';
      video.style.display = 'block';
      videoNodeRef.current = video;
    }
    if (video.parentNode !== stageNode) stageNode.appendChild(video);
    if (take?.videoUrl) {
      if (video.src !== take.videoUrl) video.src = take.videoUrl;
      video.load?.();
    }
    return () => {
      // element is removed with the node
    };
  }, [stageNode, take?.videoUrl]);

  useEffect(
    () => () => {
      const video = videoNodeRef.current;
      if (video?.parentNode) video.parentNode.removeChild(video);
      videoNodeRef.current = null;
    },
    [],
  );

  /* playback engine with the live mix graph */
  useEffect(() => {
    let disposed = false;
    let mixer: TakeMixer | null = null;
    setReady(false);
    setPlaying(false);
    setPos(0);
    const run = async () => {
      const created = await createTakeMixer({
        song,
        durationSec: duration,
        settings: settingsRef.current,
        vocalUrl: take?.vocalUrl,
        getVideo: () => videoNodeRef.current,
      });
      if (disposed) {
        created?.dispose();
        return;
      }
      mixer = created;
      mixerRef.current = created;
      setReady(Boolean(created));
    };
    void run();
    return () => {
      disposed = true;
      mixerRef.current = null;
      mixer?.dispose();
      setPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, take?.vocalUrl, duration]);

  useEffect(() => {
    const id = setInterval(() => {
      const mixer = mixerRef.current;
      if (!mixer) return;
      setPos(mixer.position());
      setPlaying(mixer.isPlaying());
    }, 120);
    return () => clearInterval(id);
  }, []);

  const togglePlay = async () => {
    const mixer = mixerRef.current;
    if (!mixer) {
      showToast('오디오를 아직 준비 중이에요. 잠시 후 다시 시도해 주세요');
      return;
    }
    if (mixer.isPlaying()) {
      mixer.pause();
      setPlaying(false);
      setPos(mixer.position());
      return;
    }
    await mixer.play();
    setPlaying(mixer.isPlaying());
  };

  const seek = (value: number) => {
    mixerRef.current?.seek(value);
    setPos(value);
  };

  const update = (patch: Partial<TakeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    mixerRef.current?.setSettings(next);
    setPreset(null);
  };

  const applyPreset = (item: Preset) => {
    setSettings(item.values);
    mixerRef.current?.setSettings(item.values);
    setPreset(item.key);
    showToast(`${item.label} 프리셋을 적용했어요`);
  };

  /* ------------------------------ export ------------------------------ */
  const startGeneration = async () => {
    if (generating) return;
    setModalOpen(true);
    setGenerating(true);
    setProgress(0);
    setElapsed(0);
    setExported(null);
    cancelRef.current = false;
    mixerRef.current?.pause();
    setPlaying(false);
    try {
      const result = await exportCoverVideo({
        song,
        durationSec: duration,
        videoUrl: take?.videoUrl,
        vocalUrl: take?.vocalUrl,
        settings,
        onProgress: (ratio, seconds) => {
          setProgress(ratio * 100);
          setElapsed(seconds);
        },
        isCancelled: () => cancelRef.current,
      });
      if (cancelRef.current) {
        setExported(null);
        showToast('영상 생성을 취소했어요');
        setModalOpen(false);
        return;
      }
      const url = URL.createObjectURL(result.blob);
      setExported({
        url,
        blob: result.blob,
        mime: result.mime,
        extension: result.extension,
        size: result.blob.size,
        width: result.width,
        height: result.height,
      });
      setProgress(100);
      showToast('커버 영상 파일이 완성됐어요');
    } catch {
      showToast('영상 생성에 실패했어요. 다시 시도해 주세요', 'alert');
      setModalOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  const fileName = useMemo(
    () => `karaoke-cover-${song.title.replace(/\s+/g, '-')}.${exported?.extension ?? 'mp4'}`,
    [song.title, exported?.extension],
  );

  const saveToDevice = () => {
    if (!exported) return;
    const ok = downloadVideo(exported.blob, fileName);
    showToast(ok ? '영상을 기기에 저장했어요' : '다운로드를 시작할 수 없어요', ok ? 'ok' : 'alert');
  };

  const shareOut = async () => {
    if (!exported) {
      showToast('먼저 최종 영상을 생성해 주세요');
      return;
    }
    const shared = await shareVideo(
      exported.blob,
      fileName,
      `${song.title} 커버`,
      `${song.artist} · Karaoke Cover Studio`,
    );
    if (shared) {
      showToast('공유 시트를 열었어요');
    } else {
      downloadVideo(exported.blob, fileName);
      showToast('이 브라우저는 파일 공유를 지원하지 않아 다운로드했어요');
    }
  };

  const closeModal = () => {
    cancelRef.current = true;
    setModalOpen(false);
  };

  /* ------------------------------ lyrics ------------------------------ */
  const audioPos = Math.max(0, pos - syncOffsetSec(settings));
  const activeIndex = useMemo(() => {
    if (song.lyrics.length === 0) return -1;
    const current = song.lyrics.findIndex(line => audioPos >= line.start && audioPos < line.end);
    if (current >= 0) return current;
    const next = song.lyrics.findIndex(line => line.start > audioPos);
    return next >= 0 ? next : song.lyrics.length - 1;
  }, [audioPos, song.lyrics]);

  const activeLine = activeIndex >= 0 ? song.lyrics[activeIndex] : null;
  const nextLine = activeIndex >= 0 ? song.lyrics[activeIndex + 1] : null;

  const specSize = exported ? `${(exported.size / (1024 * 1024)).toFixed(1)}MB` : '생성 후 표시';

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: safeTop }}>
        <TopBar
          onBack={back}
          title="결과물 편집"
          subtitle={`${song.title} · ${song.artist}`}
          right={
            <IconButton size={34} onPress={() => void shareOut()} accessibilityLabel="커버 영상 공유">
              <Text style={{ fontSize: 13, color: colors.textDim }}>↗</Text>
            </IconButton>
          }
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 9:16 preview */}
        <View style={styles.previewWrap}>
          <View style={styles.preview}>
            {hasVideo ? (
              <View ref={setStageRef} style={StyleSheet.absoluteFill} />
            ) : (
              <>
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
              </>
            )}

            <View style={styles.previewTop}>
              <Badge label={hasVideo ? 'MY TAKE' : 'COVER'} tone="coral" />
              <Text style={styles.previewSpec}>9:16</Text>
            </View>

            <View style={styles.previewCenter} pointerEvents="box-none">
              {!playing ? (
                <Pressable onPress={() => void togglePlay()} style={styles.centerPlay} accessibilityLabel="커버 미리보기 재생">
                  <PlayIcon size={20} color={colors.white} />
                </Pressable>
              ) : (
                <Pressable onPress={() => void togglePlay()} style={styles.centerPlayGhost} accessibilityLabel="커버 미리보기 일시정지">
                  <PauseIcon size={14} color={colors.white} />
                </Pressable>
              )}
            </View>

            <LinearGradient
              colors={['rgba(4,6,10,0)', 'rgba(4,6,10,0.75)', 'rgba(4,6,10,0.95)']}
              style={styles.subtitleScrim}
            />
            <View style={styles.subtitleBox} pointerEvents="none" testID="result-subtitle">
              {activeLine ? (
                wrapPhrase(activeLine.text, 12).map((row, index) => (
                  <Text key={index} style={styles.subtitleMain}>
                    {row}
                  </Text>
                ))
              ) : (
                <Text style={styles.subtitleMain}>♪ MR ♪</Text>
              )}
              <Text style={styles.subtitleNext} numberOfLines={1}>
                {nextLine?.text ?? ' '}
              </Text>
              <View style={styles.subtitleBar}>
                <View
                  style={[
                    styles.subtitleBarFill,
                    activeLine
                      ? {
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((audioPos - activeLine.start) / (activeLine.end - activeLine.start)) * 100,
                            ),
                          )}%`,
                        }
                      : { width: '0%' },
                  ]}
                />
              </View>
            </View>

            <View style={styles.previewBottom} pointerEvents="none">
              <View style={styles.previewSongRow}>
                <CoverArt cover={song.cover} size={30} radius={8} glyphSize={11} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewSongTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.previewSongArtist} numberOfLines={1}>
                    {song.artist} · cover by Studio
                  </Text>
                </View>
                <Text style={styles.previewTime} testID="result-time">{formatTime(pos)}</Text>
              </View>
              <View style={styles.previewTrack}>
                <View style={[styles.previewTrackFill, { width: `${Math.min(100, (pos / duration) * 100)}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.previewSide}>
            <Text style={styles.previewSideLabel}>TAKE 01</Text>
            <Text style={styles.previewSideValue}>{formatTime(duration)}</Text>
            <View style={styles.previewSideDivider} />
            <Text style={styles.previewSideLabel}>CAPTURE</Text>
            <Text style={styles.previewSideValue}>
              {take?.captureMode === 'dual'
                ? 'CAM+MIC'
                : take?.captureMode === 'single'
                ? '통합 녹화'
                : take?.captureMode === 'audio-only'
                ? '오디오만'
                : '모의'}
            </Text>
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
            onPress={() => void togglePlay()}
            accessibilityLabel={playing ? '미리보기 일시정지' : '미리보기 재생'}
            size={40}
            style={{ backgroundColor: colors.coral }}
          >
            {playing ? <PauseIcon size={12} color={colors.white} /> : <PlayIcon size={13} color={colors.white} />}
          </IconButton>
          <View style={{ flex: 1 }}>
            <RangeSlider
              value={pos}
              min={0}
              max={duration}
              step={0.1}
              accent={colors.coral}
              onChange={seek}
              trackHeight={4}
              thumbSize={12}
            />
          </View>
          <Text style={styles.transportTime}>
            {formatTime(pos)} / {formatTime(duration)}
          </Text>
        </View>

        <Text style={styles.engineNote}>
          {ready
            ? hasVideo
              ? '녹화된 내 영상 + 실제 보컬 트랙을 재생 중이에요 · 슬라이더를 움직이면 소리가 바로 바뀝니다'
              : 'MR 신스와 실제 믹스 그래프로 미리듣기 중이에요 · 슬라이더가 즉시 반영됩니다'
            : '오디오 그래프를 준비하고 있어요…'}
        </Text>

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
            <Pressable
              onPress={() => {
                setSettings(DEFAULT_SETTINGS);
                mixerRef.current?.setSettings(DEFAULT_SETTINGS);
                setPreset(null);
              }}
            >
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
                onPress={() => applyPreset(item)}
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
                +면 음원이 영상보다 늦게, −면 앞서 재생됩니다 · 자막과 최종 영상에도 10ms 단위로 반영
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
              { label: '해상도', value: '720 × 1280' },
              { label: '프레임', value: '30fps' },
              { label: '길이', value: formatTime(duration) },
              { label: '용량', value: specSize },
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
          label={exported ? '저장 · 공유하기' : generating ? '생성 중…' : '최종 영상 생성'}
          onPress={() => {
            if (exported) setModalOpen(true);
            else void startGeneration();
          }}
          style={{ flex: 1.4 }}
        />
      </View>

      {/* generation modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable onPress={closeModal} accessibilityLabel="닫기" style={styles.modalClose} hitSlop={10}>
              <CloseIcon size={12} color={colors.textDim} />
            </Pressable>

            {generating ? (
              <>
                <View style={styles.modalIcon}>
                  <ActivityIndicator color={colors.coral} />
                </View>
                <Text style={styles.modalTitle}>커버 영상을 만들고 있어요</Text>
                <Text style={styles.modalCaption}>
                  실제 캔버스·오디오 합성 중 · {Math.floor(elapsed)}초 / {Math.round(duration)}초 ·{' '}
                  {Math.round(progress)}%
                </Text>
                <View style={styles.modalTrack}>
                  <View style={[styles.modalFill, { width: `${Math.max(2, progress)}%` }]} />
                </View>
                <View style={styles.modalSteps}>
                  {['오디오 믹스 (보컬+Echo+Reverb+MR)', '영상 프레임 캔버스 합성', '싱크 가사 자막 렌더', '파일 인코딩'].map(
                    (label, index) => {
                      const stepIndex = Math.min(3, Math.floor((progress / 100) * 4));
                      return (
                        <View key={label} style={styles.modalStepRow}>
                          <View
                            style={[
                              styles.modalStepDot,
                              index < stepIndex && { backgroundColor: colors.mint },
                              index === stepIndex && { backgroundColor: colors.coral },
                            ]}
                          />
                          <Text style={[styles.modalStepText, index <= stepIndex && { color: colors.textDim }]}>
                            {label}
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>
                <GhostButton label="생성 취소" onPress={closeModal} style={{ marginTop: space(4), width: '100%' }} />
                <Text style={styles.modalFootnote}>실제 녹화 길이만큼 실시간으로 합성합니다</Text>
              </>
            ) : exported ? (
              <>
                <View style={[styles.modalIcon, { backgroundColor: colors.mintSoft, borderColor: 'rgba(46,230,168,0.4)' }]}>
                  <CheckIcon size={20} color={colors.mint} />
                </View>
                <Text style={styles.modalTitle}>커버 영상 파일이 완성됐어요</Text>
                <Text style={styles.modalCaption}>
                  {exported.width}×{exported.height} · 9:16 · {formatTime(duration)} ·{' '}
                  {(exported.size / (1024 * 1024)).toFixed(1)}MB · {exported.extension.toUpperCase()}
                </Text>

                <View style={styles.shareGrid}>
                  <PrimaryButton label="기기에 저장" onPress={saveToDevice} style={{ flex: 1 }} />
                  <GhostButton label="공유하기" onPress={() => void shareOut()} style={{ flex: 1 }} />
                </View>

                <Text style={styles.shareTitle}>SNS 공유</Text>
                <View style={styles.snsRow}>
                  {[
                    { label: 'YouTube Shorts', tone: '#FF4D4F' },
                    { label: 'Instagram Reels', tone: '#37C8F0' },
                  ].map(item => (
                    <Pressable
                      key={item.label}
                      onPress={() => void shareOut()}
                      style={({ pressed }) => [styles.snsButton, pressed && { opacity: 0.8 }]}
                    >
                      <View style={[styles.snsDot, { backgroundColor: item.tone }]} />
                      <Text style={styles.snsLabel}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.modalFootnote}>
                  공유 시트에서 앱을 고르면 실제 영상 파일이 첨부됩니다 · 미지원 브라우저는 다운로드
                </Text>
                <GhostButton
                  label="다시 생성"
                  onPress={() => {
                    setModalOpen(false);
                    void startGeneration();
                  }}
                  style={{ marginTop: space(3), width: '100%' }}
                />
              </>
            ) : (
              <>
                <View style={styles.modalIcon}>
                  <CheckIcon size={20} color={colors.coral} />
                </View>
                <Text style={styles.modalTitle}>최종 영상이 아직 없어요</Text>
                <Text style={styles.modalCaption}>최종 영상 생성을 눌러 실제 파일을 만들어 주세요</Text>
                <PrimaryButton
                  label="최종 영상 생성"
                  onPress={() => {
                    setModalOpen(false);
                    void startGeneration();
                  }}
                  style={{ marginTop: space(4), width: '100%' }}
                />
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
  subtitleBarFill: { height: 2, borderRadius: 2, backgroundColor: colors.coral },
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
  engineNote: {
    ...type.micro,
    color: colors.textFaint,
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: space(2),
    textAlign: 'center',
    fontWeight: '500',
  },
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
  modalFootnote: { ...type.micro, color: colors.textFaint, marginTop: space(3), fontSize: 9, textAlign: 'center', fontWeight: '500', lineHeight: 13 },
});
