import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, safeTop, space, type } from '../theme';
import { useStore } from '../store';
import { genreOrder } from '../data/mock';
import { Genre, LyricLine, UploadedMr } from '../types';
import { formatWon, todayLabel, uid } from '../utils/format';
import { formatFileSize, readAudioDuration } from '../utils/mrLibrary';
import { TopBar } from '../components/TopBar';
import { Badge, Card, Chip, Field, GhostButton, PrimaryButton, SectionHeader } from '../components/ui';
import { CoverArt } from '../components/CoverArt';
import { CheckIcon, PlusIcon, ArrowUpIcon } from '../components/Icons';

interface PickedFile {
  name: string;
  size: number;
  durationSec: number;
  blob: any;
  url: string;
  mocked?: boolean;
}

const PRICE_OPTIONS = [500, 1000, 1500, 2000];
const MAX_BYTES = 50 * 1024 * 1024;

/** Spread the studio-entered lyrics over the uploaded MR timeline. */
function buildLyrics(text: string, durationSec: number): LyricLine[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const total = Math.max(6, durationSec - 4);
  const slot = total / lines.length;
  return lines.map((line, index) => ({
    start: 2 + index * slot,
    end: 2 + index * slot + Math.max(1.2, slot - 0.4),
    text: line,
  }));
}

export function CreatorUploadScreen() {
  const { back, depth, uploads, addUpload, showToast, navigate } = useStore();

  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState<Genre>('발라드');
  const [priceText, setPriceText] = useState('1000');
  const [lyricsText, setLyricsText] = useState('');
  const [busy, setBusy] = useState(false);

  const price = Number(priceText.replace(/[^0-9]/g, '')) || 0;
  const creatorShare = Math.round(price * 0.5);
  const platformShare = price - creatorShare;

  const stats = useMemo(() => {
    const sales = uploads.reduce((sum, item) => sum + item.sales, 0);
    const revenue = uploads.reduce((sum, item) => sum + item.revenue, 0);
    const reviewing = uploads.filter(item => item.status === '심사 중').length;
    return { sales, revenue, reviewing };
  }, [uploads]);

  const canSubmit =
    Boolean(file) && title.trim().length > 1 && artist.trim().length > 0 && price >= 100 && !busy;

  const pickFile = () => {
    const g = globalThis as unknown as Record<string, any>;
    if (Platform.OS === 'web' && g.document?.createElement) {
      const input = g.document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.style.display = 'none';
      input.onchange = async (event: any) => {
        const chosen = event.target?.files?.[0];
        if (!chosen) return;
        if (chosen.size > MAX_BYTES) {
          showToast('50MB 이하 파일만 업로드할 수 있어요', 'alert');
          return;
        }
        const url = URL.createObjectURL(chosen);
        const duration = await readAudioDuration(url);
        setFile({
          name: chosen.name ?? 'mr_audio.wav',
          size: chosen.size ?? 0,
          durationSec: duration > 0 ? duration : 90,
          blob: chosen,
          url,
        });
        if (!title.trim()) {
          setTitle(
            (chosen.name ?? '')
              .replace(/\.[^.]+$/, '')
              .replace(/[_-]+/g, ' ')
              .trim()
              .slice(0, 40),
          );
        }
        showToast(
          duration > 0
            ? `실제 MR 파일을 불러왔어요 · ${Math.floor(duration / 60)}:${String(
                Math.floor(duration % 60),
              ).padStart(2, '0')}`
            : 'MR 음원 파일을 불러왔어요',
        );
      };
      g.document.body.appendChild(input);
      input.click();
      setTimeout(() => input.remove?.(), 1000);
      return;
    }
    setFile({
      name: `sample_mr_${Date.now().toString().slice(-4)}.wav`,
      size: 8420000,
      durationSec: 90,
      blob: null,
      mocked: true,
      url: '',
    });
    showToast('샘플 MR 파일을 선택했어요');
  };

  const submit = async () => {
    if (!canSubmit || !file) return;
    setBusy(true);
    const lyrics = buildLyrics(lyricsText, file.durationSec);
    const upload: UploadedMr = {
      id: uid('mr'),
      title: title.trim(),
      artist: artist.trim(),
      genre,
      price,
      fileName: file.name,
      createdAt: todayLabel(),
      sales: 0,
      revenue: 0,
      status: '심사 중',
      isNew: true,
      durationSec: Math.round(file.durationSec),
      audioUrl: file.url || undefined,
      lyrics,
    };
    try {
      await addUpload(upload, file.blob);
      showToast('MR을 업로드했어요 · 홈 목록 최상단에 추가됐어요');
      setFile(null);
      setTitle('');
      setArtist('');
      setLyricsText('');
      setPriceText('1000');
      navigate({ name: 'home' });
    } catch {
      showToast('업로드에 실패했어요. 다시 시도해 주세요', 'alert');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: safeTop }}>
        <TopBar
          onBack={depth > 1 ? back : undefined}
          title="크리에이터 스튜디오"
          right={
            <Pressable onPress={() => showToast('정산 계좌 등록은 준비 중이에요')} hitSlop={8}>
              <Text style={styles.settleLink}>정산</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* dashboard */}
        <LinearGradient
          colors={['#21131A', '#101720']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>CREATOR DASHBOARD</Text>
          <Text style={styles.heroTitle}>이번 달 수익 {formatWon(52800)}</Text>
          <Text style={styles.heroCaption}>정산일 12월 15일 · 판매 수익 50% 정산</Text>

          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{formatWon(stats.revenue)}</Text>
              <Text style={styles.statLabel}>누적 수익</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{stats.sales}건</Text>
              <Text style={styles.statLabel}>누적 판매</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{stats.reviewing}개</Text>
              <Text style={styles.statLabel}>심사 중 MR</Text>
            </View>
          </View>
        </LinearGradient>

        {/* upload form */}
        <View style={{ marginTop: space(6) }}>
          <SectionHeader title="MR 업로드" caption="내가 만든 반주를 판매하고 수익을 받아요" />

          <Card>
            {/* file */}
            <Pressable
              onPress={pickFile}
              style={({ pressed }) => [styles.dropzone, pressed && { opacity: 0.85 }, file && styles.dropzoneFilled]}
            >
              <View style={[styles.dropIcon, file && { backgroundColor: colors.mintSoft, borderColor: 'rgba(46,230,168,0.4)' }]}>
                {file ? <CheckIcon size={13} color={colors.mint} /> : <PlusIcon size={13} color={colors.coral} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropTitle} numberOfLines={1}>
                  {file ? file.name : 'MR 음원 파일 선택'}
                </Text>
                <Text style={styles.dropCaption}>
                  {file
                    ? `${formatFileSize(file.size)} · ${Math.floor(file.durationSec / 60)}:${String(
                        Math.round(file.durationSec % 60),
                      ).padStart(2, '0')}${file.mocked ? ' · 샘플 파일' : ' · 실제 파일'}
                    `
                    : 'WAV · MP3 · M4A · 최대 50MB, 보컬이 없는 반주만'}
                </Text>
              </View>
              <Text style={styles.dropAction}>{file ? '변경' : '찾아보기'}</Text>
            </Pressable>

            <View style={{ height: space(4) }} />

            <Field
              label="곡 제목"
              placeholder="예: 새벽 두 시의 너 (MR)"
              value={title}
              onChangeText={setTitle}
              maxLength={40}
            />
            <Field
              label="아티스트"
              placeholder="원곡 아티스트"
              value={artist}
              onChangeText={setArtist}
              maxLength={24}
            />

            <Text style={styles.fieldLabel}>장르</Text>
            <View style={styles.genreRow}>
              {genreOrder.map(item => (
                <Chip
                  key={item}
                  label={item}
                  compact
                  active={genre === item}
                  onPress={() => setGenre(item)}
                />
              ))}
            </View>

            <View style={{ height: space(4) }} />

            <Field
              label="가사 (선택)"
              hint="줄바꿈으로 구분 · 촬영 자막 타임라인으로 변환"
              value={lyricsText}
              onChangeText={setLyricsText}
              placeholder={'첫 번째 줄\n두 번째 줄\n세 번째 줄'}
              multiline
              numberOfLines={4}
              inputStyle={{ height: 84, textAlignVertical: 'top', paddingTop: 8 }}
            />

            <View style={{ height: space(4) }} />

            <Field
              label="판매 가격"
              hint="플랫폼 수수료 50%"
              value={priceText}
              onChangeText={text => setPriceText(text.replace(/[^0-9]/g, '').slice(0, 5))}
              keyboardType="number-pad"
              placeholder="1000"
              right={<Text style={styles.wonSuffix}>원</Text>}
            />
            <View style={styles.priceQuickRow}>
              {PRICE_OPTIONS.map(option => (
                <Pressable
                  key={option}
                  onPress={() => setPriceText(String(option))}
                  style={({ pressed }) => [
                    styles.priceQuick,
                    price === option && styles.priceQuickActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.priceQuickText, price === option && { color: colors.coral }]}>
                    ₩{option.toLocaleString('ko-KR')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* split */}
            <View style={styles.splitCard}>
              <View style={styles.splitHead}>
                <Text style={styles.splitLabel}>예상 수익 분배</Text>
                <Text style={styles.splitPrice}>{formatWon(price)}</Text>
              </View>
              <View style={styles.splitBar}>
                <View style={[styles.splitCreator, { flex: Math.max(1, creatorShare) }]} />
                <View style={[styles.splitPlatform, { flex: Math.max(1, platformShare) }]} />
              </View>
              <View style={styles.splitLegend}>
                <View style={styles.splitLegendCell}>
                  <View style={[styles.legendDot, { backgroundColor: colors.mint }]} />
                  <Text style={styles.splitLegendLabel}>크리에이터 50%</Text>
                  <Text style={styles.splitLegendValue}>{formatWon(creatorShare)}</Text>
                </View>
                <View style={styles.splitLegendCell}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textFaint }]} />
                  <Text style={styles.splitLegendLabel}>플랫폼 50%</Text>
                  <Text style={styles.splitLegendValueNeutral}>{formatWon(platformShare)}</Text>
                </View>
              </View>
              <Text style={styles.splitFootnote}>
                100건 판매 시 크리에이터 수익 {formatWon(creatorShare * 100)}
              </Text>
            </View>

            <PrimaryButton
              label={canSubmit ? 'MR 업로드하기' : busy ? '업로드 중…' : '필수 항목을 입력해 주세요'}
              onPress={() => {
                void submit();
              }}
              disabled={!canSubmit}
              icon={<ArrowUpIcon size={12} color={colors.white} />}
              style={{ marginTop: space(4) }}
            />
            <Text style={styles.formNote}>
              업로드 즉시 홈 목록 최상단에 노출되고, 곡 상세·촬영·결과 화면에서 업로드한 원음이 재생됩니다
            </Text>
          </Card>
        </View>

        {/* my uploads */}
        <View style={{ marginTop: space(6) }}>
          <SectionHeader
            title="내가 업로드한 MR"
            caption={`${uploads.length}개 · 판매 ${formatWon(stats.revenue)}`}
          />
          {uploads.map(item => (
            <UploadRow key={item.id} item={item} />
          ))}
        </View>

        <View style={styles.settleCard}>
          <Text style={styles.settleTitle}>정산 안내</Text>
          <Text style={styles.settleBody}>
            매월 1일~말일 판매분이 다음 달 15일에 등록 계좌로 입금돼요. 최소 정산 금액은 ₩10,000입니다.
          </Text>
          <GhostButton
            label="정산 계좌 등록"
            onPress={() => showToast('정산 계좌 등록은 준비 중이에요')}
            style={{ marginTop: space(3) }}
          />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

function UploadRow({ item }: { item: UploadedMr }) {
  return (
    <View style={styles.uploadRow}>
      <CoverArt cover={['#241820', '#0D1218']} size={44} radius={12} glyphSize={14} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text numberOfLines={1} style={styles.uploadTitle}>
            {item.title}
          </Text>
          {item.isNew ? <Badge label="NEW" tone="coral" /> : null}
          {item.audioUrl ? <Badge label="원음" tone="mint" /> : null}
        </View>
        <Text style={styles.uploadMeta}>
          {item.artist} · {item.genre} · {formatWon(item.price)}
          {item.durationSec ? ` · ${Math.floor(item.durationSec / 60)}:${String(Math.round(item.durationSec % 60)).padStart(2, '0')}` : ''}
        </Text>
        <View style={styles.uploadStats}>
          <Badge label={item.status} tone={item.status === '판매 중' ? 'mint' : 'amber'} dot />
          <Text style={styles.uploadStatText}>
            판매 {item.sales}건 · {formatWon(item.revenue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space(5), paddingBottom: 24 },
  settleLink: { ...type.label, color: colors.coral, fontSize: 11.5 },
  hero: {
    borderRadius: radius.xl,
    padding: space(5),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.18)',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 200,
    backgroundColor: 'rgba(255,77,79,0.16)',
    top: -90,
    right: -60,
  },
  heroKicker: { ...type.micro, color: colors.coral, fontSize: 9, letterSpacing: 1.6 },
  heroTitle: { ...type.title, fontSize: 21, color: colors.text, marginTop: 8 },
  heroCaption: { ...type.micro, color: colors.textDim, marginTop: 5, fontWeight: '500' },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space(5),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  statCell: { flex: 1, gap: 4 },
  statValue: { ...type.section, fontSize: 15, color: colors.text },
  statLabel: { ...type.micro, color: colors.textFaint, fontSize: 9.5, fontWeight: '500' },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.08)' },
  dropzone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: colors.bgSoft,
  },
  dropzoneFilled: { borderStyle: 'solid', borderColor: 'rgba(46,230,168,0.35)' },
  dropIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.coralSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: { ...type.label, color: colors.text, fontSize: 12.5 },
  dropCaption: { ...type.micro, color: colors.textFaint, marginTop: 3, fontSize: 9.5, fontWeight: '500' },
  dropAction: { ...type.micro, color: colors.coral, fontSize: 10.5 },
  fieldLabel: { ...type.label, color: colors.textDim, marginBottom: 8 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wonSuffix: { ...type.label, color: colors.textFaint, marginLeft: 6 },
  priceQuickRow: { flexDirection: 'row', gap: 6, marginTop: -4 },
  priceQuick: {
    flex: 1,
    height: 32,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  priceQuickActive: { borderColor: colors.coral, backgroundColor: colors.coralSoft },
  priceQuickText: { ...type.micro, color: colors.textDim, fontSize: 10 },
  splitCard: {
    marginTop: space(4),
    padding: space(3.5),
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  splitLabel: { ...type.micro, color: colors.textDim, fontSize: 10 },
  splitPrice: { ...type.section, color: colors.text, fontSize: 14 },
  splitBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: space(3),
    gap: 2,
  },
  splitCreator: { backgroundColor: colors.mint, borderRadius: 4 },
  splitPlatform: { backgroundColor: colors.surfaceHi, borderRadius: 4 },
  splitLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  splitLegendCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  splitLegendLabel: { ...type.micro, color: colors.textFaint, fontSize: 9.5, fontWeight: '500' },
  splitLegendValue: { ...type.micro, color: colors.mint, fontSize: 9.5 },
  splitLegendValueNeutral: { ...type.micro, color: colors.textDim, fontSize: 9.5 },
  splitFootnote: { ...type.micro, color: colors.textFaint, marginTop: 8, fontSize: 9, fontWeight: '500' },
  formNote: { ...type.micro, color: colors.textFaint, marginTop: space(2), fontSize: 9, textAlign: 'center', fontWeight: '500', lineHeight: 13 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  uploadTitle: { ...type.label, color: colors.text, fontSize: 12.5, flexShrink: 1 },
  uploadMeta: { ...type.micro, color: colors.textFaint, fontSize: 9.5, fontWeight: '500' },
  uploadStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  uploadStatText: { ...type.micro, color: colors.textDim, fontSize: 9.5, fontWeight: '500' },
  settleCard: {
    marginTop: space(6),
    padding: space(4),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settleTitle: { ...type.label, color: colors.text, fontSize: 12.5 },
  settleBody: { ...type.micro, color: colors.textDim, fontSize: 10, lineHeight: 15, marginTop: 6, fontWeight: '500' },
});
