import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { FeederStatusPanel } from '@/components/feeder-status';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { GRAMS_DEFAULT, GRAMS_MAX, GRAMS_MIN, GRAMS_STEP } from '@/config';
import { formatGrams, formatLastMeal, formatNextMealMoment } from '@/feeder/format';
import { isFeederOnline, useFeeder } from '@/feeder/provider';
import { useNow } from '@/hooks/use-now';
import { colors, fontSizes, spacing } from '@/theme';

export default function HomeScreen() {
  const { status, state, signOut, feedNow, skipNextMeal } = useFeeder();
  const now = useNow();
  const [grams, setGrams] = useState(GRAMS_DEFAULT);
  const [sending, setSending] = useState(false);

  const online = isFeederOnline(status, state);
  const blockedReason = online ? undefined : 'Só dá para mandar comando com o alimentador ligado.';

  const runCommand = (action: () => Promise<void>, successMessage: string) => {
    setSending(true);
    action()
      .then(() => {
        Alert.alert('Pronto', successMessage);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Não foi possível enviar o comando.';
        Alert.alert('Não deu certo', message);
      })
      .finally(() => {
        setSending(false);
      });
  };

  const confirmFeed = () => {
    Alert.alert('Servir comida agora?', `Vão cair ${formatGrams(grams)} no pote.`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, servir',
        onPress: () => {
          runCommand(() => feedNow(grams), 'A comida está saindo.');
        },
      },
    ]);
  };

  const confirmSkip = () => {
    Alert.alert(
      'Pular a próxima refeição?',
      'O alimentador vai deixar de servir só a próxima refeição. Depois volta ao normal.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, pular',
          onPress: () => {
            runCommand(() => skipNextMeal(), 'A próxima refeição foi cancelada.');
          },
        },
      ]
    );
  };

  const confirmSignOut = () => {
    Alert.alert('Sair do aplicativo?', 'Você vai precisar digitar a senha de novo.', [
      { text: 'Ficar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <Screen title="Alimentador">
      <FeederStatusPanel status={status} state={state} />

      <Card title="Última refeição">
        <Text style={styles.info}>{formatLastMeal(state?.lastMeal ?? null, now)}</Text>
      </Card>

      <Card title="Próxima refeição">
        <Text style={styles.info}>
          {state?.nextMeal == null
            ? 'Nenhum horário programado'
            : `${formatNextMealMoment(state.nextMeal, now)}, ${formatGrams(state.nextMeal.grams)}`}
        </Text>
        {state?.skipNext === true ? (
          <Text style={styles.warning}>Esta refeição está marcada para ser pulada.</Text>
        ) : null}
        {state?.hopperGrams == null ? null : (
          <Text style={styles.muted}>Ração no depósito: {formatGrams(state.hopperGrams)}</Text>
        )}
      </Card>

      <Card title="Servir agora">
        <Stepper
          label="Quantidade"
          value={grams}
          display={formatGrams(grams)}
          min={GRAMS_MIN}
          max={GRAMS_MAX}
          step={GRAMS_STEP}
          unitLabel="quantidade de ração"
          onChange={setGrams}
        />
        <View style={styles.spacer} />
        <BigButton
          label="ALIMENTAR AGORA"
          huge
          hint={`Serve ${formatGrams(grams)} na hora`}
          onPress={confirmFeed}
          disabled={!online || sending}
          disabledReason={sending ? 'Enviando...' : blockedReason}
        />
      </Card>

      <BigButton
        label="Pular próxima refeição"
        variant="danger"
        onPress={confirmSkip}
        disabled={!online || sending}
        disabledReason={sending ? 'Enviando...' : blockedReason}
      />

      <BigButton label="Sair" variant="secondary" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: {
    fontSize: fontSizes.large,
    color: colors.text,
    fontWeight: '600',
  },
  muted: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
  warning: {
    fontSize: fontSizes.small,
    color: colors.amber,
    fontWeight: '700',
  },
  spacer: {
    height: spacing.xs,
  },
});
