import { StyleSheet, Text, View } from 'react-native';

import { connectionLabel } from '@/feeder/format';
import type { ConnectionStatus, FeederState } from '@/feeder/types';
import { colors, fontCap, fontSizes, radius, spacing } from '@/theme';

type Tone = 'ok' | 'bad' | 'wait';

type StatusView = {
  readonly tone: Tone;
  readonly symbol: string;
  readonly headline: string;
  readonly detail: string;
};

/**
 * Traduz conexao + estado retido numa frase unica.
 * O simbolo acompanha a cor de proposito: informacao nunca so por cor
 * (WCAG 2.2 SC 1.4.1).
 */
export function describeStatus(status: ConnectionStatus, state: FeederState | null): StatusView {
  if (status.kind === 'connected') {
    if (state === null) {
      return {
        tone: 'wait',
        symbol: '…',
        headline: 'Buscando o aparelho',
        detail: 'Conectado ao servidor, esperando notícia do alimentador.',
      };
    }
    if (state.online) {
      return {
        tone: 'ok',
        symbol: '✓',
        headline: 'Alimentador ligado',
        detail: 'Tudo certo. Ele está pronto para servir a comida.',
      };
    }
    return {
      tone: 'bad',
      symbol: '✕',
      headline: 'Alimentador desligado',
      detail: 'O aparelho está sem energia ou sem internet. A agenda dele continua valendo.',
    };
  }

  if (status.kind === 'error') {
    return {
      tone: 'bad',
      symbol: '✕',
      headline: 'Sem conexão',
      detail: connectionLabel(status),
    };
  }

  return {
    tone: 'wait',
    symbol: '…',
    headline: connectionLabel(status),
    detail: 'Aguarde um instante.',
  };
}

export function FeederStatusPanel({
  status,
  state,
}: {
  readonly status: ConnectionStatus;
  readonly state: FeederState | null;
}) {
  const view = describeStatus(status, state);
  const palette = paletteFor(view.tone);

  return (
    <View
      style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.color }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${view.headline}. ${view.detail}`}>
      <Text
        style={[styles.symbol, { color: palette.color }]}
        maxFontSizeMultiplier={fontCap.display}>
        {view.symbol}
      </Text>
      <View style={styles.texts}>
        {/* Conteudo de leitura: escala livre, sem cap (WCAG 2.2 SC 1.4.4). */}
        <Text style={styles.headline}>{view.headline}</Text>
        <Text style={styles.detail}>{view.detail}</Text>
      </View>
    </View>
  );
}

function paletteFor(tone: Tone): { readonly color: string; readonly surface: string } {
  switch (tone) {
    case 'ok':
      return { color: colors.green, surface: colors.greenSurface };
    case 'bad':
      return { color: colors.red, surface: colors.redSurface };
    case 'wait':
      return { color: colors.amber, surface: colors.amberSurface };
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  symbol: {
    fontSize: fontSizes.display,
    fontWeight: '700',
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  /**
   * Texto do estado em `colors.text`, nao no tom do estado: verde #1B7F3B
   * sobre o verde claro do painel da 4.41:1, que so passa por ser texto
   * grande. Com `text` sao 16.4:1 sobre o verde claro, 15.5:1 sobre o
   * vermelho e 15.9:1 sobre o ambar. A cor do estado continua no glifo (40 dp)
   * e na borda de 2 dp, onde o limiar e 3:1.
   */
  headline: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.text,
  },
  detail: {
    fontSize: fontSizes.small,
    color: colors.text,
  },
});
