import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLetter, dayName } from '@/feeder/format';
import type { Weekday } from '@/feeder/types';
import { ALL_DAYS, hasDay, sameDays, toggleDay } from '@/feeder/weekdays';
import { colors, control, fontCap, radius, spacing, type } from '@/theme';

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
/**
 * Conjuntos nomeados que o app ja usava para LER a semana ("Seg a sex"), agora
 * tambem para ESCOLHER. Marcar cinco dias custava cinco toques em alvos
 * estreitos; aqui custa um. Reconhecer em vez de lembrar.
 */
const DAY_SETS: readonly { readonly label: string; readonly days: readonly Weekday[] }[] = [
  { label: 'Todos os dias', days: ALL_DAYS },
  { label: 'Seg a sex', days: [1, 2, 3, 4, 5] },
  { label: 'Sáb e dom', days: [0, 6] },
];

export function DayChips({ label, days, onChange }: DayChipsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.shortcuts}>
        {DAY_SETS.map((set) => {
          const selected = sameDays(days, set.days);
          return (
            <Pressable
              key={set.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={set.label}
              onPress={() => {
                onChange(set.days);
              }}
              style={({ pressed }) => [
                styles.shortcut,
                {
                  backgroundColor: selected || pressed ? colors.blueSurface : colors.white,
                  borderColor: colors.blue,
                  borderWidth: selected ? 3 : 2,
                },
              ]}>
              <Text style={styles.shortcutLabel} maxFontSizeMultiplier={fontCap.control}>
                {set.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
                maxFontSizeMultiplier={1.15}>
                {selected ? '✓' : '·'}
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
    ...type.label,
    color: colors.muted,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shortcut: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: control.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  shortcutLabel: {
    ...type.label,
    color: colors.blue,
    textAlign: 'center',
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
  // Alturas apertadas de proposito: com cap 1.3 o conteudo do chip chega a
  // ~60 dp, contra os 56 de piso. Como a altura e `minHeight`, a linha inteira
  // acompanha em vez de estourar.
  letter: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  mark: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
});
