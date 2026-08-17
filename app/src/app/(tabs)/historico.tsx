import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { eventLabel, eventSymbol, formatMoment } from '@/feeder/format';
import { useFeeder } from '@/feeder/provider';
import { useNow } from '@/hooks/use-now';
import type { FeederEventEntry } from '@/feeder/types';
import { colors, fontCap, fontSizes, radius, spacing, type } from '@/theme';

/**
 * Historico da sessao: o que chegou no topico `event` enquanto o aplicativo
 * esteve aberto. Nao ha persistencia por decisao de escopo, e a tela diz isso
 * com todas as letras para ninguem achar que perdeu dado.
 */
export default function HistoricoScreen() {
  const { events, clearEvents } = useFeeder();
  const now = useNow();

  if (events.length === 0) {
    return (
      <Screen title="Histórico">
        <View style={styles.empty}>
          <MaterialIcons name="list-alt" size={40} color={colors.muted} />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Nada aconteceu ainda
          </Text>
          <Text style={styles.emptyBody}>
            Aqui vão aparecer as refeições servidas, os avisos de sirene e os problemas, conforme
            forem acontecendo. A lista recomeça toda vez que o aplicativo é aberto.
          </Text>
        </View>
      </Screen>
    );
  }

  const groups = groupByDay(events, now);

  return (
    <Screen title="Histórico">
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header">
            {group.title}
          </Text>
          {group.entries.map((entry) => (
            <EventRow key={entry.id} entry={entry} now={now} />
          ))}
        </View>
      ))}

      <BigButton label="Limpar a lista" variant="secondary" onPress={clearEvents} />

      {/* O aviso sai do topo: ele explicava a lista e empurrava a lista para
          fora da tela. No fim, ele fecha o assunto sem custar espaco nobre. */}
      <Text style={styles.note}>
        A lista mostra o que aconteceu desde que o aplicativo foi aberto. Ao fechar, ela recomeça.
      </Text>
    </Screen>
  );
}

type DayGroup = {
  readonly title: string;
  readonly entries: readonly FeederEventEntry[];
};

/**
 * Junta os eventos por dia. Cem cartoes iguais em fila nao contam uma
 * historia; "Hoje", "Ontem" e a data dao o eixo do tempo de volta.
 */
function groupByDay(entries: readonly FeederEventEntry[], now: Date): readonly DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const title = dayTitle(entry.receivedAt, now);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.title === title) {
      groups[groups.length - 1] = { title, entries: [...last.entries, entry] };
      continue;
    }
    groups.push({ title, entries: [entry] });
  }
  return groups;
}

/** "Hoje", "Ontem" ou "12/08". Reaproveita o criterio de `formatMoment`. */
function dayTitle(date: Date, now: Date): string {
  const moment = formatMoment(date.toISOString(), now);
  if (moment.startsWith('hoje')) {
    return 'Hoje';
  }
  if (moment.startsWith('ontem')) {
    return 'Ontem';
  }
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}`;
}

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

function EventRow({ entry, now }: { readonly entry: FeederEventEntry; readonly now: Date }) {
  const failed = entry.event.kind === 'meal_failed';
  const tone = failed ? colors.red : colors.green;

  return (
    // Falha nao muda so a cor do glifo: muda o fundo e a borda do cartao
    // inteiro. Cor reforca o estado, nunca o carrega sozinha.
    <View
      style={[
        styles.row,
        failed ? { backgroundColor: colors.redSurface, borderColor: colors.red } : null,
      ]}
      accessible
      accessibilityRole="text">
      <Text
        style={[styles.symbol, { color: tone }]}
        maxFontSizeMultiplier={fontCap.display}>
        {eventSymbol(entry.event)}
      </Text>
      <View style={styles.rowTexts}>
        <Text style={styles.label}>{eventLabel(entry.event)}</Text>
        <Text style={styles.time}>{formatMoment(entry.receivedAt.toISOString(), now)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    ...type.title,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: fontSizes.small,
    color: colors.text,
    textAlign: 'center',
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    ...type.label,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  symbol: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    width: 32,
    textAlign: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.text,
  },
  time: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
});
