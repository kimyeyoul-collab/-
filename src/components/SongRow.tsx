import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CoverArt } from './CoverArt';
import { ChevronRight } from './Icons';
import { Badge } from './ui';
import { colors, space, type } from '../theme';
import { Song } from '../types';
import { formatCount, formatTime } from '../utils/format';
import { findCreator } from '../data/mock';

export function SongRow({ song, onPress, rank }: { song: Song; onPress: () => void; rank?: number }) {
  const creator = findCreator(song.creatorId);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      {rank ? <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text> : null}
      <CoverArt cover={song.cover} size={52} radius={13} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {song.title}
          </Text>
          {song.isNew ? <Badge label="NEW" tone="coral" /> : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {song.artist} · {song.genre} · {song.difficulty}
        </Text>
        <Text numberOfLines={1} style={styles.creator}>
          MR {creator.name} · 재생 {formatCount(song.plays)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.duration}>{formatTime(song.durationSec)}</Text>
        <ChevronRight size={10} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    paddingHorizontal: space(1),
    borderRadius: 14,
  },
  rank: {
    ...type.label,
    color: colors.textFaint,
    width: 20,
    fontSize: 12,
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...type.body, color: colors.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  meta: { ...type.micro, color: colors.textDim, fontWeight: '500' },
  creator: { ...type.micro, color: colors.textFaint, fontWeight: '500' },
  right: { alignItems: 'flex-end', gap: 6 },
  duration: { ...type.micro, color: colors.textDim, fontWeight: '600' },
});
