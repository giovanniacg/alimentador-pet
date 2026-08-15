import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fontSizes, radius, spacing } from '@/theme';

type CardProps = {
  readonly title?: string;
  readonly children: ReactNode;
  readonly style?: ViewStyle;
};

/** Bloco de conteudo com fundo suave e borda visivel. */
export function Card({ title, children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title === undefined ? null : (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
