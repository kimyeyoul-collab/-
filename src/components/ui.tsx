import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, space, type } from '../theme';

/* ---------------------------------- Card --------------------------------- */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

/* --------------------------------- Button -------------------------------- */

interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'coral' | 'mint' | 'light';
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  style,
  tone = 'coral',
}: ButtonProps) {
  const bg = tone === 'coral' ? colors.coral : tone === 'mint' ? colors.mint : colors.text;
  const fg = tone === 'light' ? colors.bg : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        disabled && styles.buttonDisabled,
        pressed && !disabled && { opacity: 0.86 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <View style={{ marginRight: space(2) }}>{icon}</View> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.ghost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && { backgroundColor: colors.surfaceHi },
        style,
      ]}
    >
      {icon ? <View style={{ marginRight: space(2) }}>{icon}</View> : null}
      <Text style={[styles.buttonLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  children,
  onPress,
  style,
  size = 38,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { backgroundColor: colors.surfaceHi },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ---------------------------------- Chip --------------------------------- */

export function Chip({
  label,
  active,
  onPress,
  compact,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        active ? styles.chipActive : styles.chipIdle,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          compact && { fontSize: 11 },
          { color: active ? colors.white : colors.textDim },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------- Badge --------------------------------- */

export function Badge({
  label,
  tone = 'neutral',
  dot,
}: {
  label: string;
  tone?: 'neutral' | 'coral' | 'mint' | 'amber' | 'cyan';
  dot?: boolean;
}) {
  const map = {
    neutral: { bg: colors.surfaceHi, fg: colors.textDim },
    coral: { bg: colors.coralSoft, fg: colors.coral },
    mint: { bg: colors.mintSoft, fg: colors.mint },
    amber: { bg: 'rgba(255,176,32,0.14)', fg: colors.amber },
    cyan: { bg: 'rgba(55,200,240,0.14)', fg: colors.cyan },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {dot ? (
        <View
          style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: map.fg, marginRight: 5 }}
        />
      ) : null}
      <Text style={[styles.badgeLabel, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------ Section title ----------------------------- */

export function SectionHeader({
  title,
  caption,
  actionLabel,
  onAction,
}: {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* --------------------------------- Field --------------------------------- */

export function Field({
  label,
  hint,
  right,
  containerStyle,
  inputStyle,
  ...rest
}: TextInputProps & {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.coral}
          {...rest}
          style={[styles.input, inputStyle]}
        />
        {right}
      </View>
    </View>
  );
}

/* -------------------------------- Divider -------------------------------- */

export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.divider, style]} />
);

/* ------------------------------ Empty state ------------------------------ */

export function EmptyState({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {caption ? <Text style={styles.emptyCaption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPadded: { padding: space(4) },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: space(5),
  },
  buttonDisabled: { opacity: 0.4 },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLabel: { ...type.section, fontSize: 15 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chip: {
    paddingHorizontal: space(3.5),
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipCompact: { height: 28, paddingHorizontal: space(2.5) },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipLabel: { ...type.label, fontSize: 12.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(2),
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  badgeLabel: { ...type.micro, fontSize: 10.5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: space(3),
  },
  sectionTitle: { ...type.section, color: colors.text },
  sectionCaption: { ...type.label, color: colors.textFaint, marginTop: 3, fontWeight: '500' },
  sectionAction: { ...type.label, color: colors.coral },
  field: { marginBottom: space(3.5) },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  fieldLabel: { ...type.label, color: colors.textDim },
  fieldHint: { ...type.micro, color: colors.textFaint, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(3),
  },
  input: {
    flex: 1,
    height: 46,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '600',
  },
  divider: { height: 1, backgroundColor: colors.border },
  empty: {
    paddingVertical: space(8),
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { ...type.body, color: colors.textDim },
  emptyCaption: { ...type.label, color: colors.textFaint, fontWeight: '500' },
});
