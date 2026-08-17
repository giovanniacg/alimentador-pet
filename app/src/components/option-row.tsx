import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, control, fontCap, fontSizes, radius, spacing } from '@/theme';

type OptionRowProps = {
  readonly title: string;
  /** Explicacao em linguagem simples, sempre visivel. */
  readonly description: string;
  readonly selected: boolean;
  readonly onPress: () => void;
};

/**
 * Uma opcao de escolha unica, do tamanho de um cartao.
 *
 * `accessibilityRole="radio"` com `accessibilityState.checked` da o papel e o
 * estado ao leitor de tela (WCAG 2.2 SC 4.1.2), e a marca "✓" repete a
 * selecao em simbolo, para nao depender so de cor (SC 1.4.1).
 */
export function OptionRow({ title, description, selected, onPress }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: selected ? colors.blue : colors.border,
          borderWidth: selected ? 3 : 2,
          backgroundColor: pressed ? colors.blueSurface : colors.white,
        },
      ]}>
      <Text
        style={[styles.mark, { color: selected ? colors.blue : colors.muted }]}
        maxFontSizeMultiplier={fontCap.display}>
        {selected ? '✓' : '○'}
      </Text>
      <View style={styles.texts}>
        <Text
          style={[styles.title, { color: selected ? colors.blue : colors.text }]}
          maxFontSizeMultiplier={fontCap.control}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: control.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  mark: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
  description: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
});
