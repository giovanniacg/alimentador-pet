import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { eventLabel, eventSymbol, formatMoment } from '@/feeder/format';
import { useFeeder } from '@/feeder/provider';
import { useNow } from '@/hooks/use-now';
import type { FeederEventEntry } from '@/feeder/types';
import { colors, fontSizes, radius, spacing } from '@/theme';

/**
 * Historico da sessao: o que chegou no topico `event` enquanto o aplicativo
 * esteve aberto. Nao ha persistencia por decisao de escopo, e a tela diz isso
 * com todas as letras para ninguem achar que perdeu dado.
 */
export default function HistoricoScreen() {
  const { events, clearEvents } = useFeeder();
  const now = useNow();

  return (
    <Screen title="Histórico">
      <Card>
        <Text style={styles.note}>
          A lista mostra o que aconteceu desde que o aplicativo foi aberto. Ao fechar, ela recomeça.
        </Text>
      </Card>

      {events.length === 0 ? (
        <Card>
          <Text style={styles.empty}>Nada aconteceu ainda.</Text>
        </Card>
      ) : (
        events.map((entry) => <EventRow key={entry.id} entry={entry} now={now} />)
      )}

      {events.length === 0 ? null : (
        <BigButton label="Limpar a lista" variant="secondary" onPress={clearEvents} />
      )}
    </Screen>
  );
}

function EventRow({ entry, now }: { readonly entry: FeederEventEntry; readonly now: Date }) {
  const failed = entry.event.kind === 'meal_failed';
  const tone = failed ? colors.red : colors.green;

  return (
    <View style={styles.row} accessible accessibilityRole="text">
      <Text style={[styles.symbol, { color: tone }]}>{eventSymbol(entry.event)}</Text>
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
    fontSize: fontSizes.body,
    color: colors.muted,
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
    width: 28,
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
