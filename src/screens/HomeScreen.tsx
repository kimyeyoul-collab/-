import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, safeTop, space, type } from '../theme';
import { genreOrder, creators, recentSongIds, findCreator } from '../data/mock';
import { Genre, Song } from '../types';
import { CoverArt } from '../components/CoverArt';
import { SongRow } from '../components/SongRow';
import { SearchIcon, CloseIcon, Logo, NoteGlyph, MicIcon } from '../components/Icons';
import { Badge, Chip, SectionHeader } from '../components/ui';
import { useStore } from '../store';
import { formatCount, formatTime } from '../utils/format';

type SortKey = 'latest' | 'popular';

export function HomeScreen() {
  const { navigate, showToast, songs } = useStore();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<Genre | '전체'>('전체');
  const [sort, setSort] = useState<SortKey>('latest');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter(song => (genre === '전체' ? true : song.genre === genre))
      .filter(song =>
        q.length === 0
          ? true
          : song.title.toLowerCase().includes(q) ||
            song.artist.toLowerCase().includes(q) ||
            findCreator(song.creatorId).name.toLowerCase().includes(q),
      );
  }, [query, genre, songs]);

  const browsing = query.trim().length > 0 || genre !== '전체';

  const list = useMemo(() => {
    const copy = [...filtered];
    if (sort === 'latest') return copy.sort((a, b) => a.releasedDaysAgo - b.releasedDaysAgo);
    return copy.sort((a, b) => b.plays - a.plays);
  }, [filtered, sort]);

  const recent = recentSongIds.map(id => songs.find(song => song.id === id)!).filter(Boolean);

  const openSong = (song: Song) => navigate({ name: 'song', songId: song.id });

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${
    ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]
  }요일`;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo size={30} />
            <View>
              <Text style={styles.brandTop}>KARAOKE</Text>
              <Text style={styles.brandBottom}>COVER STUDIO</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Badge label="MVP" tone="mint" dot />
            <Pressable
              onPress={() => navigate({ name: 'creator' })}
              style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.avatarText}>♪</Text>
            </Pressable>
          </View>
        </View>

        {/* greeting */}
        <View style={styles.greeting}>
          <Text style={styles.kicker}>{dateLabel} · 오늘의 커버</Text>
          <Text style={styles.headline}>오늘,{'\n'}어떤 곡을 부를까요?</Text>
        </View>

        {/* search */}
        <View style={styles.search}>
          <SearchIcon size={15} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="곡 제목, 아티스트, MR 크리에이터 검색"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.coral}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <CloseIcon size={11} color={colors.textFaint} />
            </Pressable>
          ) : (
            <View style={styles.searchHint}>
              <Text style={styles.searchHintText}>MR</Text>
            </View>
          )}
        </View>

        {/* genre filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(['전체', ...genreOrder] as const).map(item => (
            <Chip
              key={item}
              label={item}
              active={genre === item}
              onPress={() => setGenre(item as Genre | '전체')}
            />
          ))}
        </ScrollView>

        {browsing ? (
          <View style={styles.section}>
            <SectionHeader
              title={`검색 결과 ${list.length}곡`}
              caption={genre !== '전체' ? `${genre} MR` : '전체 장르'}
              actionLabel="필터 초기화"
              onAction={() => {
                setQuery('');
                setGenre('전체');
              }}
            />
            {list.length === 0 ? (
              <Text style={styles.empty}>검색 결과가 없어요. 다른 키워드로 찾아보세요.</Text>
            ) : (
              list.map(song => (
                <SongRow key={song.id} song={song} onPress={() => openSong(song)} />
              ))
            )}
          </View>
        ) : (
          <>
            {/* recent */}
            <View style={styles.section}>
              <SectionHeader title="최근 사용한 MR" caption="이어서 연습하기" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentRow}
              >
                {recent.map(song => (
                  <Pressable
                    key={song.id}
                    onPress={() => openSong(song)}
                    style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
                  >
                    <View>
                      <CoverArt cover={song.cover} size={126} radius={18} />
                      <View style={styles.recentPlay}>
                        <NoteGlyph size={11} color={colors.white} />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.recentTitle}>
                      {song.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.recentMeta}>
                      {song.key} · {formatTime(song.durationSec)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* creators */}
            <View style={styles.section}>
              <SectionHeader
                title="인기 크리에이터 MR"
                caption="지금 가장 많이 불린 편곡"
                actionLabel="전체"
                onAction={() => showToast('크리에이터 전체 보기는 준비 중이에요')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.creatorRow}
              >
                {creators.slice(0, 3).map(creator => {
                  const top = songs.filter(song => song.creatorId === creator.id)[0] ?? songs[0];
                  return (
                    <Pressable
                      key={creator.id}
                      onPress={() => openSong(top)}
                      style={({ pressed }) => [styles.creatorCard, pressed && { opacity: 0.9 }]}
                    >
                      <LinearGradient
                        colors={[`${creator.accent[0]}33`, 'rgba(12,17,23,0.4)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.creatorTop}>
                        <View style={[styles.creatorAvatar, { borderColor: creator.accent[0] }]}>
                          <Text style={[styles.creatorInitial, { color: creator.accent[0] }]}>
                            {creator.name.slice(0, 1)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.creatorName}>{creator.name}</Text>
                            {creator.verified ? (
                              <View style={styles.verified}>
                                <Text style={styles.verifiedMark}>✓</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.creatorHandle}>{creator.handle}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={2} style={styles.creatorTagline}>
                        {creator.tagline}
                      </Text>
                      <View style={styles.creatorStats}>
                        <Text style={styles.creatorStat}>MR {creator.mrCount}곡</Text>
                        <View style={styles.statDot} />
                        <Text style={styles.creatorStat}>재생 {formatCount(creator.plays)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* songs */}
            <View style={styles.section}>
              <SectionHeader
                title="곡 탐색"
                caption={`${songs.length}개의 MR`}
                actionLabel={sort === 'latest' ? '인기순' : '최신순'}
                onAction={() => setSort(sort === 'latest' ? 'popular' : 'latest')}
              />
              <View style={styles.sortRow}>
                {(
                  [
                    { key: 'latest', label: '최신곡' },
                    { key: 'popular', label: '인기곡' },
                  ] as const
                ).map(item => (
                  <Pressable
                    key={item.key}
                    onPress={() => setSort(item.key)}
                    style={[styles.sortTab, sort === item.key && styles.sortTabActive]}
                  >
                    <Text
                      style={[styles.sortLabel, sort === item.key && { color: colors.text }]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {list.map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  rank={sort === 'popular' ? index + 1 : undefined}
                  onPress={() => openSong(song)}
                />
              ))}
            </View>

            {/* creator promo */}
            <Pressable
              onPress={() => navigate({ name: 'creator' })}
              style={({ pressed }) => [styles.promo, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#251014', '#12181F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.promoIcon}>
                <MicIcon size={15} color={colors.coral} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>내 MR을 올리고 수익 받기</Text>
                <Text style={styles.promoCaption}>
                  판매 수익 50% 정산 · 심사 24시간 이내
                </Text>
              </View>
              <Text style={styles.promoArrow}>›</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.footnote}>
          모든 음원·가사는 데모용 가상 데이터입니다 · 9:16 세로형 커버 전용
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: safeTop, paddingBottom: 104 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(5),
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandTop: { ...type.micro, color: colors.textDim, letterSpacing: 2.4, fontSize: 9 },
  brandBottom: { ...type.label, color: colors.text, fontSize: 13, letterSpacing: 0.6, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  greeting: { paddingHorizontal: space(5), marginTop: space(6), marginBottom: space(4) },
  kicker: { ...type.micro, color: colors.coral, letterSpacing: 0.4, marginBottom: 8 },
  headline: { ...type.display, color: colors.text, lineHeight: 34 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space(5),
    height: 48,
    paddingHorizontal: space(3.5),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: '600', height: '100%' },
  searchHint: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceHi,
  },
  searchHintText: { ...type.micro, color: colors.textFaint, fontSize: 9.5 },
  chips: { paddingHorizontal: space(5), gap: 7, paddingVertical: space(3.5) },
  section: { paddingHorizontal: space(5), marginTop: space(4) },
  recentRow: { gap: 12, paddingRight: space(2) },
  recentCard: { width: 126 },
  recentPlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(8,11,16,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: { ...type.label, color: colors.text, marginTop: 8, fontSize: 12.5 },
  recentMeta: { ...type.micro, color: colors.textFaint, marginTop: 2, fontWeight: '500' },
  creatorRow: { gap: 12, paddingRight: space(2) },
  creatorCard: {
    width: 214,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space(3.5),
    overflow: 'hidden',
    gap: 9,
  },
  creatorTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  creatorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  creatorInitial: { fontSize: 12.5, fontWeight: '800' },
  creatorName: { ...type.label, color: colors.text, fontSize: 12.5 },
  creatorHandle: { ...type.micro, color: colors.textFaint, marginTop: 1, fontWeight: '500' },
  verified: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedMark: { color: colors.bg, fontSize: 7, fontWeight: '900' },
  creatorTagline: { ...type.micro, color: colors.textDim, lineHeight: 15, fontWeight: '500', minHeight: 30 },
  creatorStats: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  creatorStat: { ...type.micro, color: colors.textFaint, fontWeight: '600' },
  statDot: { width: 2, height: 2, borderRadius: 2, backgroundColor: colors.textFaint },
  sortRow: { flexDirection: 'row', gap: 6, marginBottom: space(2) },
  sortTab: {
    paddingHorizontal: space(3),
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  sortTabActive: { backgroundColor: colors.surfaceAlt },
  sortLabel: { ...type.label, color: colors.textFaint, fontSize: 11.5 },
  empty: { ...type.body, color: colors.textFaint, paddingVertical: space(8), textAlign: 'center' },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: space(5),
    marginTop: space(6),
    padding: space(4),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.28)',
    overflow: 'hidden',
  },
  promoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { ...type.label, color: colors.text, fontSize: 13 },
  promoCaption: { ...type.micro, color: colors.textDim, marginTop: 3, fontWeight: '500' },
  promoArrow: { color: colors.textFaint, fontSize: 20, fontWeight: '300' },
  footnote: {
    ...type.micro,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: space(6),
    fontWeight: '500',
  },
});
