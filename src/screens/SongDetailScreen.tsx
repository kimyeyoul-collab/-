import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, safeTop, shadow, space, type } from '../theme';
import { findCreator } from '../data/mock';
import { getAudioContext, resumeAudio } from '../audio/webaudio';
import { createMrSource, MrSource } from '../audio/mr';
import { useClock } from '../hooks/useClock';
import { CoverArt } from '../components/CoverArt';
import { MrWaveform } from '../components/AudioBars';
import { TopBar } from '../components/TopBar';
import { RangeSlider } from '../components/RangeSlider';
import { Badge, Card, IconButton, PrimaryButton, SectionHeader } from '../components/ui';
import { MicIcon, PauseIcon, PlayIcon } from '../components/Icons';
import { useStore } from '../store';
import { formatCount, formatTime } from '../utils/format';
import { DEFAULT_SETTINGS } from '../types';

export function SongDetailScreen({ songId }: { songId: string }) {
  const { back, navigate, favorites, toggleFavorite, showToast, setTake, getSong } = useStore();
  const song = getSong(songId);
  const creator = findCreator(song.creatorId);

  const clock = useClock(song.durationSec);
  const mrRef = useRef<MrSource | null>(null);
  const busRef = useRef<any>(null);
  const liked = favorites.includes(song.id);
  const hasFile = Boolean(song.audioUrl);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!clock.playing) {
        mrRef.current?.stop();
        return;
      }
      const ctx = getAudioContext();
      if (!ctx) return;
      await resumeAudio(ctx);
      if (cancelled) return;
      if (!mrRef.current) {
        busRef.current = ctx.createGain();
        busRef.current.gain.value = 0.9;
        busRef.current.connect(ctx.destination);
        mrRef.current = await createMrSource(song, ctx, busRef.current);
      }
      if (cancelled) return;
      mrRef.current?.play(clock.posRef.current);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [clock.playing, song]);

  useEffect(
    () => () => {
      mrRef.current?.dispose();
      mrRef.current = null;
      try {
        busRef.current?.disconnect();
      } catch {
        // ignore
      }
      busRef.current = null;
    },
    [],
  );

  const seekMr = (value: number) => {
    clock.seek(value);
    if (clock.playing) mrRef.current?.play(value);
  };

  const startCover = () => {
    clock.pause();
    setTake({ songId: song.id, durationSec: song.durationSec, settings: DEFAULT_SETTINGS, createdAt: Date.now() });
    navigate({ name: 'recording', songId: song.id });
  };

  const activeIndex = song.lyrics.findIndex(line => clock.pos >= line.start && clock.pos < line.end);

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: safeTop }}>
        <TopBar
          onBack={back}
          title="곡 상세"
          right={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <IconButton onPress={() => toggleFavorite(song.id)} size={34}>
                <Text style={{ fontSize: 15, color: liked ? colors.coral : colors.textDim }}>
                  {liked ? '♥' : '♡'}
                </Text>
              </IconButton>
              <IconButton onPress={() => showToast('공유 링크를 복사했어요 (데모)')} size={34}>
                <Text style={{ fontSize: 13, color: colors.textDim }}>↗</Text>
              </IconButton>
            </View>
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[`${song.cover[0]}66`, `${song.cover[0]}18`, 'rgba(8,11,16,0)']}
            style={styles.heroGlow}
          />
          <View style={styles.heroCover}>
            <CoverArt cover={song.cover} size={168} radius={24} glyphSize={44} />
          </View>
          <View style={styles.heroMeta}>
            <Badge label={song.genre} tone="coral" />
            <Text style={styles.title}>{song.title}</Text>
            <Text style={styles.artist}>{song.artist}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaItem}>곡 길이 {formatTime(song.fullDurationSec)}</Text>
              <View style={styles.dot} />
              <Text style={styles.metaItem}>커버 구간 {formatTime(song.durationSec)}</Text>
              <View style={styles.dot} />
              <Text style={styles.metaItem}>키 {song.key}</Text>
            </View>
            <View style={[styles.metaRow, { marginTop: 6 }]}>
              <Text style={styles.metaItem}>BPM {song.bpm}</Text>
              <View style={styles.dot} />
              <Text style={styles.metaItem}>난이도 {song.difficulty}</Text>
              <View style={styles.dot} />
              <Text style={styles.metaItem}>재생 {formatCount(song.plays)}</Text>
            </View>
          </View>
        </View>

        {/* creator */}
        <Card style={styles.creatorCard}>
          <View style={[styles.avatar, { borderColor: `${creator.accent[0]}88` }]}>
            <Text style={[styles.avatarText, { color: creator.accent[0] }]}>
              {creator.name.slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.creatorName}>{creator.name}</Text>
              {creator.verified ? <Badge label="인증" tone="cyan" /> : null}
            </View>
            <Text style={styles.creatorMeta}>
              MR {creator.mrCount}곡 · 재생 {formatCount(creator.plays)} · {creator.tagline}
            </Text>
          </View>
          <Pressable
            onPress={() => showToast(`${creator.name} 님을 팔로우했어요`)}
            style={({ pressed }) => [styles.follow, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.followText}>팔로우</Text>
          </Pressable>
        </Card>

        {/* MR preview */}
        <Card style={{ marginTop: space(4) }}>
          <View style={styles.previewHead}>
            <View>
              <Text style={styles.cardTitle}>MR 미리 듣기</Text>
              <Text style={styles.cardCaption}>
                {hasFile
                  ? '크리에이터가 업로드한 실제 MR 파일 재생'
                  : 'Web Audio 신스 데모 · 업로드한 MR은 원음으로 재생돼요'}
              </Text>
            </View>
            <Badge label="미리듣기" tone="mint" dot />
          </View>

          <View style={styles.playerRow}>
            <Pressable
              onPress={clock.toggle}
              accessibilityLabel={clock.playing ? '미리 듣기 일시정지' : '미리 듣기 재생'}
              style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.85 }]}
            >
              {clock.playing ? (
                <PauseIcon size={12} color={colors.white} />
              ) : (
                <PlayIcon size={13} color={colors.white} />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <MrWaveform progress={clock.pos / song.durationSec} height={30} />
              <View style={styles.timeRow}>
                <Text style={styles.time}>{formatTime(clock.pos)}</Text>
                <Text style={styles.time}>{formatTime(song.durationSec)}</Text>
              </View>
            </View>
          </View>

          <RangeSlider
            value={clock.pos}
            min={0}
            max={song.durationSec}
            step={0.5}
            accent={colors.mint}
            onChange={seekMr}
            trackHeight={4}
            thumbSize={14}
          />
          <View style={styles.previewFoot}>
            <Text style={styles.previewFootText}>구간 이동</Text>
            <Pressable onPress={() => seekMr(0)} hitSlop={8}>
              <Text style={styles.resetText}>처음으로</Text>
            </Pressable>
          </View>
        </Card>

        {/* lyrics */}
        <View style={{ marginTop: space(5) }}>
          <SectionHeader
            title="가사 전체 미리보기"
            caption={`${song.lyrics.length}줄 · 촬영 중 박자에 맞춰 하이라이트`}
          />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <View style={{ paddingVertical: space(2) }}>
                {song.lyrics.length === 0 ? (
                  <Text style={styles.lyricEmpty}>가사가 없어요 · MR만으로 진행되고 자막 없이 촬영됩니다</Text>
                ) : null}
                {song.lyrics.map((line, index) => {
                  const active = index === activeIndex;
                  return (
                    <Pressable
                      key={`${line.start}-${index}`}
                      onPress={() => seekMr(line.start)}
                      style={({ pressed }) => [
                        styles.lyricLine,
                        active && styles.lyricActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.lyricTime, active && { color: colors.coral }]}>
                        {formatTime(line.start)}
                      </Text>
                      <Text style={[styles.lyricText, active && styles.lyricTextActive]}>
                        {line.text}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </Card>
        </View>

        <View style={styles.tipCard}>
          <MicIcon size={13} color={colors.coral} />
          <Text style={styles.tipText}>
            이 MR로 만들어진 커버 {formatCount(Math.round(song.plays / 340))}개 · 9:16 세로 영상으로 저장됩니다
          </Text>
        </View>
        <View style={{ height: 108 }} />
      </ScrollView>

      {/* sticky CTA */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.price}>{`₩${song.price.toLocaleString('ko-KR')}`}</Text>
          <Text style={styles.priceCaption}>MR 1곡 · 평생 소장</Text>
        </View>
        <PrimaryButton
          label="커버 촬영 시작"
          onPress={startCover}
          icon={<MicIcon size={12} color={colors.white} />}
          style={{ flex: 1.55 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space(5), paddingBottom: 24 },
  hero: { alignItems: 'center', paddingTop: space(2) },
  heroGlow: {
    position: 'absolute',
    top: -40,
    left: -60,
    right: -60,
    height: 300,
    opacity: 0.55,
  },
  heroCover: { ...shadow.card },
  heroMeta: { alignItems: 'center', marginTop: space(4), gap: 6 },
  title: { ...type.title, fontSize: 23, color: colors.text, marginTop: 4 },
  artist: { ...type.body, color: colors.textDim, fontSize: 13.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  metaItem: { ...type.micro, color: colors.textFaint, fontWeight: '600' },
  dot: { width: 2.5, height: 2.5, borderRadius: 3, backgroundColor: colors.textFaint, opacity: 0.7 },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: space(6),
    padding: space(3.5),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  creatorName: { ...type.label, color: colors.text, fontSize: 13 },
  creatorMeta: { ...type.micro, color: colors.textFaint, marginTop: 3, fontWeight: '500' },
  follow: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.coralSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.35)',
  },
  followText: { ...type.micro, color: colors.coral, fontSize: 10.5 },
  previewHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { ...type.label, color: colors.text, fontSize: 13.5 },
  cardCaption: { ...type.micro, color: colors.textFaint, marginTop: 3, fontWeight: '500' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: space(4) },
  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { ...type.micro, color: colors.textFaint, fontWeight: '600' },
  previewFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  previewFootText: { ...type.micro, color: colors.textFaint, fontWeight: '500' },
  resetText: { ...type.micro, color: colors.textDim, fontWeight: '600' },
  lyricEmpty: { ...type.body, color: colors.textFaint, fontSize: 12, paddingHorizontal: space(4), paddingVertical: space(3) },
  lyricLine: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: space(4),
    paddingVertical: 8,
  },
  lyricActive: { backgroundColor: colors.coralSoft },
  lyricTime: { ...type.micro, color: colors.textFaint, width: 34, fontWeight: '600', marginTop: 2 },
  lyricText: { ...type.body, color: colors.textDim, flex: 1, fontSize: 13.5, lineHeight: 20 },
  lyricTextActive: { color: colors.text, fontWeight: '700' },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: space(5),
    padding: space(3),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipText: { ...type.micro, color: colors.textDim, flex: 1, lineHeight: 15, fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    paddingHorizontal: space(5),
    paddingTop: space(3),
    paddingBottom: space(5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(8,11,16,0.96)',
  },
  price: { ...type.section, color: colors.text, fontSize: 16 },
  priceCaption: { ...type.micro, color: colors.textFaint, marginTop: 2, fontWeight: '500' },
});
