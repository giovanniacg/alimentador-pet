import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, control, fontCap, fontSizes, iconSize, radius, spacing } from '@/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type Variant = 'primary' | 'secondary' | 'danger';

type BigButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: Variant;
  /** Frase curta abaixo do rotulo, para explicar sem jargao. */
  readonly hint?: string;
  readonly disabled?: boolean;
  /** Motivo do bloqueio, lido por leitor de tela e mostrado em texto. */
  readonly disabledReason?: string;
  /**
   * Botao primario da tela: 64 dp em vez de 56. O destaque vem da soma de
   * altura, fundo solido, largura total e icone, nunca de tamanho de fonte.
   */
  readonly emphasis?: boolean;
  /** Icone opcional ao lado do rotulo. Decorativo: o texto e que nomeia o botao. */
  readonly icon?: IconName;
  readonly style?: ViewStyle;
};

/**
 * Botao grande, de alto contraste.
 *
 * Alvo de toque bem acima do minimo de 24x24 do WCAG 2.2 (SC 2.5.8) e estado
 * desabilitado comunicado por texto, nunca so por cor (SC 1.4.1).
 */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  hint,
  disabled = false,
  disabledReason,
  emphasis = false,
  icon,
  style,
}: BigButtonProps) {
  const palette = paletteFor(variant, disabled);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={disabled ? disabledReason : hint}
        accessibilityState={{ disabled }}
        accessible
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          emphasis ? styles.emphasis : null,
          {
            backgroundColor: pressed ? palette.pressed : palette.background,
            borderColor: palette.border,
          },
          style,
        ]}>
        <View style={styles.labelRow}>
          {icon === undefined ? null : (
            <MaterialIcons name={icon} size={iconSize.lg} color={palette.text} />
          )}
          {/* Rotulo de controle: cap 1.3 e quebra em duas linhas, nunca trunca
              (sem `numberOfLines`). A caixa cresce junto pelo `minHeight`. */}
          <Text
            style={[styles.label, { color: palette.text }]}
            maxFontSizeMultiplier={fontCap.control}>
            {label}
          </Text>
        </View>
        {hint === undefined || disabled ? null : (
          <Text style={[styles.hint, { color: palette.text }]}>{hint}</Text>
        )}
      </Pressable>
      {disabled && disabledReason !== undefined ? (
        <Text style={styles.reason}>{disabledReason}</Text>
      ) : null}
    </View>
  );
}

function paletteFor(variant: Variant, disabled: boolean) {
  if (disabled) {
    return {
      background: colors.disabledSurface,
      pressed: colors.disabledSurface,
      border: colors.disabled,
      text: colors.disabled,
    };
  }
  switch (variant) {
    case 'primary':
      return {
        background: colors.green,
        pressed: '#14602C',
        border: colors.green,
        text: colors.white,
      };
    case 'secondary':
      return {
        background: colors.white,
        pressed: colors.blueSurface,
        border: colors.blue,
        text: colors.blue,
      };
    case 'danger':
      return {
        background: colors.white,
        pressed: colors.redSurface,
        border: colors.red,
        text: colors.red,
      };
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  button: {
    minHeight: control.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emphasis: {
    minHeight: control.xl,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  label: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSizes.small,
    textAlign: 'center',
  },
  reason: {
    fontSize: fontSizes.small,
    color: colors.muted,
    textAlign: 'center',
  },
});
