import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLetter, dayName } from '@/feeder/format';
import type { Weekday } from '@/feeder/types';
import { ALL_DAYS, hasDay, toggleDay } from '@/feeder/weekdays';
import { colors, control, fontCap, fontSizes, radius, spacing } from '@/theme';

type DayChipsProps = {
  readonly label: string;
  readonly days: readonly Weekday[];
  readonly onChange: (next: readonly Weekday[]) => void;
};

/**
 * Sete chips de dia da semana, um toque cada, sem arrastar (WCAG 2.2 SC 2.5.7).
 *
 * O dia marcado muda de preenchimento E ganha um "✓", porque estado nunca pode
 * depender so de cor (SC 1.4.1). Cada chip e um `checkbox` com estado, e o nome
 * acessivel usa o dia por extenso, nao a letra solta (SC 4.1.2).
 *
 * Os sete chips ficam numa LINHA SO, dividindo a largura em partes iguais
 * (`flexBasis: 0`). Nao ha `flexWrap`: era ele, somado a `flexGrow`, que
 * jogava o sabado sozinho para a segunda linha e o esticava na largura toda.
 * Quem garante o alvo de toque aqui e a ALTURA (56 dp), nao a largura: mesmo
 * numa tela de 320 dp o chip sai com ~33x56, bem acima dos 24x24 do SC 2.5.8.
 */
export function DayChips({ label, days, onChange }: DayChipsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="none">
        {ALL_DAYS.map((day) => {
          const selected = hasDay(days, day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={dayName(day)}
              accessible
              onPress={() => {
                onChange(toggleDay(days, day));
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected
                    ? colors.blue
                    : pressed
                      ? colors.blueSurface
                      : colors.white,
                  borderColor: selected ? colors.blue : colors.border,
                },
              ]}>
              <Text
                style={[styles.letter, { color: selected ? colors.white : colors.text }]}
                maxFontSizeMultiplier={fontCap.control}>
                {dayLetter(day)}
              </Text>
              <Text
                style={[styles.mark, { color: selected ? colors.white : colors.muted }]}
                maxFontSizeMultiplier={fontCap.control}>
                {selected ? '✓' : '−'}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  row: {
    flexDirection: 'row',
    // Sem `flexWrap` de proposito: a semana e lida como uma regua continua.
    gap: spacing.xs,
  },
  chip: {
    // `flexBasis: 0` ignora o conteudo e divide a linha em sete partes iguais.
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: control.lg,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  letter: {
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
  mark: {
    fontSize: fontSizes.small,
    fontWeight: '700',
  },
});
