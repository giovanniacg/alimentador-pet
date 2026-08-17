import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { FeederStatusPanel } from '@/components/feeder-status';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { CONFIG_DEFAULTS, GRAMS_DEFAULT, SECS_DEFAULT } from '@/config';
import {
  describeDose,
  doseFieldLabel,
  doseUnitName,
  formatDose,
  formatGrams,
  formatLastMeal,
  formatNextMealMoment,
  formatSeconds,
  scaleReadingLabel,
} from '@/feeder/format';
import {
  clamp,
  doseAmount,
  doseForMode,
  doseLimits,
  doseUnitForMode,
  makeDose,
} from '@/feeder/mode';
import { isFeederOnline, useFeeder } from '@/feeder/provider';
import type { Dose } from '@/feeder/types';
import { useNow } from '@/hooks/use-now';
import { colors, fontSizes, spacing } from '@/theme';

export default function HomeScreen() {
  const { status, state, config, mode, gramsPerSecond, signOut, feedNow, skipNextMeal, soundSiren } =
    useFeeder();
  const now = useNow();
  /** `chosen === null` significa "usar a dose rápida gravada no aparelho". */
  const [chosen, setChosen] = useState<Dose | null>(null);
  const [sending, setSending] = useState(false);

  const online = isFeederOnline(status, state);
  const blockedReason = online ? undefined : 'Só dá para mandar comando com o alimentador ligado.';

  // A unidade da dose segue o modo do aparelho. Se o modo mudar, a escolha
  // antiga (em segundos, por exemplo) e descartada no proprio render em vez de
  // ser corrigida num Effect.
  const unit = doseUnitForMode(mode);
  const limits = doseLimits(unit, config?.maxSecs ?? CONFIG_DEFAULTS.maxSecs);
  const fallback = makeDose(
    unit,
    unit === 'secs'
      ? (config?.defaultSecs ?? SECS_DEFAULT)
      : (config?.defaultGrams ?? GRAMS_DEFAULT)
  );
  const picked = chosen !== null && chosen.unit === unit ? chosen : fallback;
  const dose = makeDose(unit, clamp(doseAmount(picked), limits.min, limits.max));
  const amount = doseAmount(dose);

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
    Alert.alert('Servir comida agora?', `Vão cair ${describeDose(dose)} no pote.`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, servir',
        onPress: () => {
          runCommand(() => feedNow(dose), 'A comida está saindo.');
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

  // A sirene apita dentro da casa dos pais: confirma antes, sempre, e diz
  // quanto tempo vai durar.
  const sirenSecs = config?.sirenSecs ?? null;
  const confirmSiren = () => {
    Alert.alert(
      'Tocar a sirene agora?',
      sirenSecs === null
        ? 'O aparelho vai apitar na casa, sem servir comida.'
        : `O aparelho vai apitar por ${formatSeconds(sirenSecs)} na casa, sem servir comida.`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, tocar',
          onPress: () => {
            runCommand(
              () => soundSiren(sirenSecs ?? undefined),
              'A sirene tocou no alimentador.'
            );
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

  const nextMeal = state?.nextMeal ?? null;

  return (
    <Screen title="Alimentador">
      <FeederStatusPanel status={status} state={state} />

      <Card title="Última refeição">
        <Text style={styles.info}>{formatLastMeal(state?.lastMeal ?? null, now)}</Text>
      </Card>

      <Card title="Próxima refeição">
        <Text style={styles.info}>
          {nextMeal === null
            ? 'Nenhum horário programado'
            : `${formatNextMealMoment(nextMeal, now)}, ${describeDose(doseForMode(nextMeal.dose, mode, gramsPerSecond))}`}
        </Text>
        {state?.skipNext === true ? (
          <Text style={styles.warning}>Esta refeição está marcada para ser pulada.</Text>
        ) : null}
        {state?.scaleGrams == null ? null : (
          <Text style={styles.muted}>
            {scaleReadingLabel(mode)}: {formatGrams(state.scaleGrams)}
          </Text>
        )}
      </Card>

      <Card title="Servir agora">
        <Stepper
          label={doseFieldLabel(mode)}
          value={amount}
          display={formatDose(dose)}
          min={limits.min}
          max={limits.max}
          step={limits.step}
          unitLabel={doseUnitName(mode)}
          onChange={(next) => {
            setChosen(makeDose(unit, next));
          }}
        />
        <View style={styles.spacer} />
        <BigButton
          label="ALIMENTAR AGORA"
          huge
          hint={`Serve ${describeDose(dose)} na hora`}
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

      <BigButton
        label="Tocar sirene"
        variant="secondary"
        icon="notifications-active"
        hint="Chama o bicho sem servir comida"
        onPress={confirmSiren}
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
