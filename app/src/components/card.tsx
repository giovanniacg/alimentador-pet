import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useDensity } from '@/hooks/use-density';
import { colors, radius, spacing, type } from '@/theme';

type CardProps = {
  readonly title?: string;
  readonly children: ReactNode;
  readonly style?: ViewStyle;
};

/** Bloco de conteudo com fundo suave e borda visivel. */
export function Card({ title, children, style }: CardProps) {
  const density = useDensity();

  return (
    <View style={[styles.card, { padding: density.padding }, style]}>
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
    gap: spacing.sm,
  },
  /**
   * Sem caixa alta e sem `letterSpacing` fixo: caixa alta apaga o perfil da
   * palavra e derruba a velocidade de leitura, e espacamento numerico chumbado
   * nao acompanha ampliacao de espacamento de texto. O papel de "rotulo de
   * secao" vem de peso e posicao. Cor `text` tambem sobe o contraste sobre o
   * fundo do cartao (17.1:1, contra 8.0:1 do `muted`).
   */
  title: {
    ...type.label,
    color: colors.text,
    letterSpacing: 0,
  },
});
