import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { Toggle } from '@/components/toggle';
import {
  GRAMS_MAX,
  GRAMS_MIN,
  GRAMS_STEP,
  G_PER_S_MAX,
  G_PER_S_MIN,
  G_PER_S_STEP,
  KNOWN_WEIGHT_DEFAULT,
  KNOWN_WEIGHT_MAX,
  KNOWN_WEIGHT_MIN,
  KNOWN_WEIGHT_STEP,
  MAX_SECS_MAX,
  MAX_SECS_MIN,
  MAX_SECS_STEP,
  RPM_MAX,
  RPM_MIN,
  RPM_STEP,
  SECS_MIN,
  SIREN_SECS_MAX,
  SIREN_SECS_MIN,
  SIREN_SECS_STEP,
} from '@/config';
import {
  formatGrams,
  formatGramsPerSecond,
  formatRtc,
  formatSeconds,
  modeExplanation,
  modeLabel,
  scaleReadingLabel,
} from '@/feeder/format';
import { isScaleMode } from '@/feeder/mode';
import { configDiff } from '@/feeder/parse';
import { isFeederOnline, useFeeder } from '@/feeder/provider';
import type { ConfigPatch, FeedMode, FeederConfig } from '@/feeder/types';
import { useNow } from '@/hooks/use-now';
import { colors, fontSizes, radius, spacing } from '@/theme';

const MODES: readonly FeedMode[] = ['timer', 'scale_bowl', 'scale_hopper'];

/**
 * Tela de administracao remota. Quem opera aqui e o Giovanni, de longe; os
 * pais dele vivem nas outras tres abas. Mesmo assim o texto continua em
 * linguagem simples: quem mexe cansado tambem erra.
 *
 * Nada e aplicado sozinho: as mudancas ficam num rascunho e so viram
 * `cmd/config` (objeto parcial, so o que mudou) ao tocar em salvar.
 */
export default function AjustesScreen() {
  const { config, state, status, mode: activeMode, saveConfig, tare, calibrate } = useFeeder();
  const now = useNow();
  /** `draft === null` significa "igual ao que esta no aparelho". */
  const [draft, setDraft] = useState<FeederConfig | null>(null);
  const [knownGrams, setKnownGrams] = useState(KNOWN_WEIGHT_DEFAULT);
  const [sending, setSending] = useState(false);

  const online = isFeederOnline(status, state);
  const appVersion = Constants.expoConfig?.version ?? 'desconhecida';

  const runCommand = (action: () => Promise<void>, successMessage: string, done?: () => void) => {
    setSending(true);
    action()
      .then(() => {
        done?.();
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

  if (config === null) {
    return (
      <Screen title="Ajustes">
        <Card title="Ajustes do aparelho">
          <Text style={styles.muted}>
            Ainda não recebemos os ajustes gravados no alimentador. Assim que ele responder, tudo
            aparece aqui.
          </Text>
        </Card>
        <TechnicalFooter
          rtc={formatRtc(state?.rtc ?? null, now)}
          activeMode={activeMode}
          firmwareVersion={state?.version ?? null}
          appVersion={appVersion}
        />
      </Screen>
    );
  }

  const current: FeederConfig = draft ?? config;
  const patch: ConfigPatch = configDiff(current, config);
  const pending = Object.keys(patch).length > 0;
  const modeChanged = patch.mode !== undefined;
  const draftIsScale = isScaleMode(current.mode);
  const deviceIsScale = isScaleMode(activeMode);

  const update = (change: ConfigPatch) => {
    setDraft({ ...current, ...change });
  };

  const applyPatch = () => {
    runCommand(() => saveConfig(patch), 'Os ajustes foram enviados para o alimentador.', () => {
      setDraft(null);
    });
  };

  const confirmSave = () => {
    if (!modeChanged) {
      applyPatch();
      return;
    }
    Alert.alert(
      'Mudar o modo de dosagem?',
      `O aparelho vai sair de "${modeLabel(config.mode)}" para "${modeLabel(current.mode)}".\n\n${modeExplanation(current.mode)}\n\nOs horários já gravados passam a valer nessa nova medida.`,
      [
        { text: 'Não mudar', style: 'cancel' },
        { text: 'Sim, mudar', onPress: applyPatch },
      ]
    );
  };

  const confirmTare = () => {
    Alert.alert(
      'Zerar a balança?',
      'Faça isso com o prato vazio e parado. O peso passa a contar do zero a partir de agora.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Zerar',
          onPress: () => {
            runCommand(() => tare(), 'A balança foi zerada.');
          },
        },
      ]
    );
  };

  const confirmCalibrate = () => {
    Alert.alert(
      'Calibrar a balança?',
      `Coloque um peso conhecido de ${formatGrams(knownGrams)} na balança antes de continuar.`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Calibrar',
          onPress: () => {
            runCommand(() => calibrate(knownGrams), 'A balança foi calibrada.');
          },
        },
      ]
    );
  };

  return (
    <Screen title="Ajustes">
      {pending ? (
        <View style={styles.pendingBox} accessibilityRole="alert">
          <Text style={styles.pendingText}>
            Você mexeu nos ajustes. Toque em SALVAR NO ALIMENTADOR para valer de verdade.
          </Text>
        </View>
      ) : null}

      <Card title="Modo de dosagem">
        <Text style={styles.muted}>
          É assim que o aparelho decide quanta ração já saiu. Sem balança, ele conta o tempo de
          rosca girando.
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {MODES.map((option) => (
            <OptionRow
              key={option}
              title={modeLabel(option)}
              description={modeExplanation(option)}
              selected={current.mode === option}
              onPress={() => {
                update({ mode: option });
              }}
            />
          ))}
        </View>
        {modeChanged ? (
          <Text style={styles.warning}>
            O aparelho ainda está em &quot;{modeLabel(config.mode)}&quot;. A troca só acontece ao
            salvar.
          </Text>
        ) : null}
      </Card>

      <Card title="Dose rápida">
        <Text style={styles.muted}>
          Quanto sai quando alguém aperta o botão do aparelho, sem escolher quantidade.
        </Text>
        {draftIsScale ? (
          <Stepper
            label="Dose rápida (gramas)"
            value={current.defaultGrams}
            display={formatGrams(current.defaultGrams)}
            min={GRAMS_MIN}
            max={GRAMS_MAX}
            step={GRAMS_STEP}
            unitLabel="dose rápida em gramas"
            onChange={(defaultGrams) => {
              update({ defaultGrams });
            }}
          />
        ) : (
          <Stepper
            label="Dose rápida (segundos)"
            value={current.defaultSecs}
            display={formatSeconds(current.defaultSecs)}
            min={SECS_MIN}
            max={current.maxSecs}
            step={1}
            unitLabel="dose rápida em segundos"
            onChange={(defaultSecs) => {
              update({ defaultSecs });
            }}
          />
        )}
      </Card>

      <Card title="Motor">
        <Text style={styles.muted}>
          Velocidade da rosca. Mais devagar embola menos a ração; mais rápido serve antes.
        </Text>
        <Stepper
          label="Velocidade"
          value={current.rpm}
          display={`${current.rpm} rpm`}
          min={RPM_MIN}
          max={RPM_MAX}
          step={RPM_STEP}
          unitLabel="velocidade do motor"
          onChange={(rpm) => {
            update({ rpm });
          }}
        />
      </Card>

      <Card title="Limite de segurança">
        <Text style={styles.muted}>
          Tempo máximo que a rosca pode girar numa única dose. Serve de freio se algo travar.
        </Text>
        <Stepper
          label="Tempo máximo por dose"
          value={current.maxSecs}
          display={formatSeconds(current.maxSecs)}
          min={MAX_SECS_MIN}
          max={MAX_SECS_MAX}
          step={MAX_SECS_STEP}
          unitLabel="tempo máximo por dose"
          onChange={(maxSecs) => {
            update({ maxSecs, defaultSecs: Math.min(current.defaultSecs, maxSecs) });
          }}
        />
      </Card>

      <Card title="Sirene">
        <Text style={styles.muted}>Um aviso sonoro antes da refeição, para chamar o bicho.</Text>
        <Toggle
          label="Sirene antes de servir"
          value={current.siren}
          onChange={(siren) => {
            update({ siren });
          }}
        />
        {current.siren ? (
          <Stepper
            label="Duração do aviso"
            value={current.sirenSecs}
            display={formatSeconds(current.sirenSecs)}
            min={SIREN_SECS_MIN}
            max={SIREN_SECS_MAX}
            step={SIREN_SECS_STEP}
            unitLabel="duração da sirene"
            onChange={(sirenSecs) => {
              update({ sirenSecs });
            }}
          />
        ) : null}
      </Card>

      <Card title="Gramas por segundo (estimativa)">
        <Text style={styles.muted}>
          Quantas gramas de ração saem em um segundo de rosca. Serve para converter tempo em peso
          quando o horário foi criado num modo e o aparelho está em outro. É uma estimativa: se a
          dose sair maior ou menor do que o esperado, ajuste aqui.
        </Text>
        <Stepper
          label="Estimativa"
          value={current.gramsPerSecond}
          display={formatGramsPerSecond(current.gramsPerSecond)}
          min={G_PER_S_MIN}
          max={G_PER_S_MAX}
          step={G_PER_S_STEP}
          unitLabel="gramas por segundo"
          onChange={(gramsPerSecond) => {
            update({ gramsPerSecond: Math.round(gramsPerSecond * 10) / 10 });
          }}
        />
      </Card>

      <BigButton
        label="SALVAR NO ALIMENTADOR"
        onPress={confirmSave}
        disabled={!online || sending || !pending}
        disabledReason={
          sending
            ? 'Enviando...'
            : !online
              ? 'Só dá para salvar com o alimentador ligado.'
              : 'Nada mudou para salvar.'
        }
      />

      {pending ? (
        <BigButton
          label="Desfazer mudanças"
          variant="secondary"
          onPress={() => {
            setDraft(null);
          }}
        />
      ) : null}

      {deviceIsScale ? (
        <Card title="Balança">
          <Text style={styles.info}>
            {scaleReadingLabel(activeMode)}:{' '}
            {state?.scaleGrams == null ? 'sem leitura' : formatGrams(state.scaleGrams)}
          </Text>
          <Text style={styles.muted}>
            Zerar deixa o peso atual valendo como zero. Calibrar ensina o aparelho quanto pesa um
            peso que você já conhece.
          </Text>
          <BigButton
            label="Zerar a balança (tara)"
            variant="secondary"
            onPress={confirmTare}
            disabled={!online || sending}
            disabledReason={sending ? 'Enviando...' : 'Só dá para zerar com o alimentador ligado.'}
          />
          <Stepper
            label="Peso conhecido para calibrar"
            value={knownGrams}
            display={formatGrams(knownGrams)}
            min={KNOWN_WEIGHT_MIN}
            max={KNOWN_WEIGHT_MAX}
            step={KNOWN_WEIGHT_STEP}
            unitLabel="peso conhecido"
            onChange={setKnownGrams}
          />
          <BigButton
            label="Calibrar a balança"
            variant="secondary"
            onPress={confirmCalibrate}
            disabled={!online || sending}
            disabledReason={
              sending ? 'Enviando...' : 'Só dá para calibrar com o alimentador ligado.'
            }
          />
        </Card>
      ) : (
        <Card title="Balança">
          <Text style={styles.muted}>
            O aparelho está sem balança neste modo. Zerar e calibrar só aparecem depois de escolher
            um modo com balança e salvar.
          </Text>
        </Card>
      )}

      <TechnicalFooter
        rtc={formatRtc(state?.rtc ?? null, now)}
        activeMode={activeMode}
        firmwareVersion={state?.version ?? null}
        appVersion={appVersion}
      />
    </Screen>
  );
}

/** Rodape tecnico: o que o Giovanni olha antes de perguntar "cadê o problema". */
function TechnicalFooter({
  rtc,
  activeMode,
  firmwareVersion,
  appVersion,
}: {
  readonly rtc: string;
  readonly activeMode: FeedMode;
  readonly firmwareVersion: string | null;
  readonly appVersion: string;
}) {
  return (
    <Card title="Informações técnicas">
      <FooterLine label="Relógio do aparelho" value={rtc} />
      <FooterLine label="Modo em uso agora" value={modeLabel(activeMode)} />
      <FooterLine label="Versão do firmware" value={firmwareVersion ?? 'não informada'} />
      <FooterLine label="Versão do aplicativo" value={appVersion} />
    </Card>
  );
}

function FooterLine({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.footerLine} accessible accessibilityRole="text">
      <Text style={styles.footerLabel}>{label}</Text>
      <Text style={styles.footerValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
  info: {
    fontSize: fontSizes.large,
    color: colors.text,
    fontWeight: '600',
  },
  warning: {
    fontSize: fontSizes.small,
    color: colors.amber,
    fontWeight: '700',
  },
  options: {
    gap: spacing.sm,
  },
  pendingBox: {
    backgroundColor: colors.amberSurface,
    borderColor: colors.amber,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pendingText: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '600',
  },
  footerLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  footerLabel: {
    fontSize: fontSizes.small,
    color: colors.muted,
    flexShrink: 1,
  },
  footerValue: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
});
