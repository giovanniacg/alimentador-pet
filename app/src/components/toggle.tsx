import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, control, fontCap, fontSizes, radius, spacing } from '@/theme';

type ToggleProps = {
  readonly label: string;
  readonly value: boolean;
  /** Texto do estado ligado e do desligado, em linguagem simples. */
  readonly onText?: string;
  readonly offText?: string;
  readonly onChange: (next: boolean) => void;
};

/**
 * Liga/desliga em botao grande, no lugar do Switch nativo.
 *
 * O Switch do sistema e pequeno demais para o publico do app e depende de
 * arrastar em alguns aparelhos; aqui e um toque so, num alvo de 56 dp
 * (WCAG 2.2 SC 2.5.7 e SC 2.5.8). O estado aparece escrito e em simbolo,
 * nunca so em cor (SC 1.4.1).
 */
export function Toggle({
  label,
  value,
  onText = 'Ligada',
  offText = 'Desligada',
  onChange,
}: ToggleProps) {
  const tone = value ? colors.green : colors.muted;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        accessibilityHint={value ? 'Toque para desligar' : 'Toque para ligar'}
        onPress={() => {
          onChange(!value);
        }}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: tone,
            backgroundColor: pressed ? colors.surface : colors.white,
          },
        ]}>
        <Text style={[styles.mark, { color: tone }]} maxFontSizeMultiplier={fontCap.control}>
          {value ? '✓' : '✕'}
        </Text>
        <Text style={[styles.text, { color: tone }]} maxFontSizeMultiplier={fontCap.control}>
          {value ? onText : offText}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.small,
    color: colors.muted,
    fontWeight: '600',
  },
  button: {
    minHeight: control.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mark: {
    fontSize: fontSizes.large,
    fontWeight: '700',
  },
  text: {
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
});
