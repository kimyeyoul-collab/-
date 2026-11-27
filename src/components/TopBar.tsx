import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';
import { ChevronLeft } from './Icons';
import { IconButton } from './ui';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function TopBar({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton onPress={onBack} size={36} accessibilityLabel="뒤로">
            <ChevronLeft size={13} color={colors.text} />
          </IconButton>
        ) : null}
      </View>
      <View style={styles.center}>
        {title ? (
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, { justifyContent: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(3),
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: space(2),
    minHeight: 48,
  },
  side: { width: 76, flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center' },
  title: { ...type.section, fontSize: 14.5, color: colors.text },
  subtitle: { ...type.micro, color: colors.textFaint, marginTop: 2, fontWeight: '500' },
});
