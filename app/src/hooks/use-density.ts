import { useWindowDimensions } from 'react-native';

/**
 * Densidade adaptativa: em zoom alto o ar cede primeiro.
 *
 * Conteudo e alvo de toque nunca cedem; o que encolhe e o espaco entre os
 * blocos. Num celular com a fonte do sistema aumentada, oito blocos com 16 dp
 * de respiro somam mais de 120 dp de rolagem so de vazio, num viewport que o
 * proprio zoom ja encurtou. Os valores continuam na grade de 4 e 8 dp.
 */
export function useDensity() {
  const { fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.3;
  return {
    compact,
    gap: compact ? 12 : 16,
    sectionGap: compact ? 16 : 24,
    padding: compact ? 12 : 16,
  } as const;
}
