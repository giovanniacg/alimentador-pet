import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, control, fontCap, fontSizes, radius, spacing } from '@/theme';

type StepperProps = {
  readonly label: string;
  readonly value: number;
  readonly display: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** True para dar a volta (23h + 1 = 0h). */
  readonly wrap?: boolean;
  readonly unitLabel: string;
  readonly onChange: (next: number) => void;
};

/**
 * Ajuste por dois botoes grandes, sem arrastar.
 * WCAG 2.2 SC 2.5.7 pede alternativa a movimento de arraste; aqui simplesmente
 * nao existe slider.
 */
export function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  wrap = false,
  unitLabel,
  onChange,
}: StepperProps) {
  const decrease = () => {
    const next = value - step;
    if (next < min) {
      onChange(wrap ? max : min);
      return;
    }
    onChange(next);
  };

  const increase = () => {
    const next = value + step;
    if (next > max) {
      onChange(wrap ? min : max);
      return;
    }
    onChange(next);
  };

  const canDecrease = wrap || value > min;
  const canIncrease = wrap || value < max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <StepButton
          symbol="−"
          accessibilityLabel={`Diminuir ${unitLabel}`}
          disabled={!canDecrease}
          onPress={decrease}
        />
        <Text
          style={styles.value}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${label}: ${display}`}
          maxFontSizeMultiplier={fontCap.display}>
          {display}
        </Text>
        <StepButton
          symbol="+"
          accessibilityLabel={`Aumentar ${unitLabel}`}
          disabled={!canIncrease}
          onPress={increase}
        />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  readonly symbol: string;
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        {
          backgroundColor: disabled
            ? colors.disabledSurface
            : pressed
              ? colors.blueSurface
              : colors.white,
          borderColor: disabled ? colors.disabled : colors.blue,
        },
      ]}>
      <Text
        style={[styles.stepSymbol, { color: disabled ? colors.disabled : colors.blue }]}
        maxFontSizeMultiplier={fontCap.display}>
        {symbol}
      </Text>
    </Pressable>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stepButton: {
    width: control.lg,
    height: control.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSymbol: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    lineHeight: fontSizes.title + 4,
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
  },
});
