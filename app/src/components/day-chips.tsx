import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLetter, dayName } from '@/feeder/format';
import type { Weekday } from '@/feeder/types';
import { ALL_DAYS, hasDay, toggleDay } from '@/feeder/weekdays';
import { MIN_CHIP_TOUCH, colors, fontSizes, radius, spacing } from '@/theme';

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
 * acessivel usa o dia por extenso, nao a letra solta (SC 4.1.2). Os chips
 * quebram de linha em vez de encolher: 44 dp e o piso do alvo.
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
                maxFontSizeMultiplier={1.3}>
                {dayLetter(day)}
              </Text>
              <Text
                style={[styles.mark, { color: selected ? colors.white : colors.muted }]}
                maxFontSizeMultiplier={1.3}>
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
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minWidth: MIN_CHIP_TOUCH,
    minHeight: MIN_CHIP_TOUCH,
    flexGrow: 1,
    flexBasis: MIN_CHIP_TOUCH,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
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
