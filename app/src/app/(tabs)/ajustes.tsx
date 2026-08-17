import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { OptionRow } from '@/components/option-row';
import { SaveBar } from '@/components/save-bar';
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
import { colors, control, fontCap, fontSizes, radius, spacing, type } from '@/theme';

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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
        <ConfigPlaceholder />
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

  const discardDraft = () => {
    setDraft(null);
  };

  return (
    <Screen
      title="Ajustes"
      footer={
        pending ? (
          <SaveBar
            label="Salvar no alimentador"
            onSave={confirmSave}
            onDiscard={discardDraft}
            disabled={!online || sending}
            disabledReason={
              sending ? 'Enviando...' : 'Só dá para salvar com o alimentador ligado.'
            }
          />
        ) : null
      }>
      {/* O aviso de rascunho fica na barra fixa do rodape. */}

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
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Text style={styles.noticeSymbol}>!</Text>
            <Text style={styles.noticeText}>
              O aparelho ainda está em &quot;{modeLabel(config.mode)}&quot;. A troca só acontece ao
              salvar.
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Os tres ajustes mais raros e mais arriscados ficam guardados atras de
          um toque: a tela abre com o que se usa toda semana. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        accessibilityLabel="Ajustes avançados"
        onPress={() => {
          setAdvancedOpen((open) => !open);
        }}
        style={({ pressed }) => [
          styles.advancedToggle,
          { backgroundColor: pressed ? colors.surface : colors.white },
        ]}>
        <Text style={styles.advancedLabel} maxFontSizeMultiplier={fontCap.control}>
          Ajustes avançados
        </Text>
        <Text style={styles.advancedMark} maxFontSizeMultiplier={fontCap.control}>
          {advancedOpen ? '▾' : '▸'}
        </Text>
      </Pressable>

      {advancedOpen ? (
        <>
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

          <Card title="Gramas por segundo">
            <Text style={styles.muted}>
              Quantas gramas saem em um segundo de rosca. Só importa quando um horário foi criado
              em segundos e o aparelho está pesando em gramas.
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
        </>
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

/** Quanto tempo esperar o aparelho responder antes de assumir que deu ruim. */
const CONFIG_WAIT_MS = 10000;

/**
 * Enquanto os ajustes nao chegam, a tela precisa dizer em qual dos tres
 * estados esta. Carregando, vazio e erro nao podem ter a mesma cara: parado
 * no mesmo texto por dez segundos, o app parece travado e o usuario nao tem
 * saida nenhuma.
 */
function ConfigPlaceholder() {
  const [waited, setWaited] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWaited(true);
    }, CONFIG_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [attempt]);

  if (!waited) {
    return (
      <Card title="Ajustes do aparelho">
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.placeholderTitle} accessibilityRole="header">
            Buscando os ajustes
          </Text>
          <Text style={styles.placeholderBody}>
            Assim que o alimentador responder, tudo aparece aqui.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card title="Ajustes do aparelho">
      <View style={styles.placeholder} accessibilityRole="alert">
        <Text style={styles.placeholderSymbol}>!</Text>
        <Text style={styles.placeholderTitle} accessibilityRole="header">
          Não conseguimos falar com o alimentador
        </Text>
        <Text style={styles.placeholderBody}>Confira se ele está ligado e na tomada.</Text>
        <BigButton
          label="Tentar de novo"
          variant="secondary"
          hint="O aplicativo continua tentando sozinho enquanto esta tela estiver aberta."
          onPress={() => {
            setWaited(false);
            setAttempt((current) => current + 1);
          }}
        />
      </View>
    </Card>
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
  options: {
    gap: spacing.sm,
  },
  /**
   * Aviso local promovido: fundo e borda ambar carregam o alerta e o texto
   * fica em `colors.text`. Ambar sobre branco em 16 dp era o aviso mais fraco
   * da tela, justo o que diz que o aparelho ainda nao mudou de modo.
   */
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.amberSurface,
    borderColor: colors.amber,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeSymbol: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.amber,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  advancedToggle: {
    minHeight: control.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  advancedLabel: {
    ...type.label,
    color: colors.text,
  },
  advancedMark: {
    ...type.label,
    color: colors.blue,
  },
  placeholder: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  placeholderSymbol: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.red,
  },
  placeholderTitle: {
    ...type.title,
    color: colors.text,
    textAlign: 'center',
  },
  placeholderBody: {
    fontSize: fontSizes.small,
    color: colors.text,
    textAlign: 'center',
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
