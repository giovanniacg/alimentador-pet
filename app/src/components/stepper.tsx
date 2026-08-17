import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, control, fontCap, fontSizes, radius, spacing, type } from '@/theme';

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
  const repeat = useRepeatOnHold(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={repeat.start}
      onPressOut={repeat.stop}
      delayLongPress={400}
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

/** Repeticao a cada 300 ms; depois de 1,5 s de dedo apoiado, a cada 120 ms. */
const REPEAT_MS = 300;
const FAST_REPEAT_MS = 120;
const ACCELERATE_AFTER_MS = 1500;

/**
 * Segurar o botao repete o passo.
 *
 * Ir de 5 a 200 g de 5 em 5 sao 39 toques. Isto e pressao, nao arraste: o
 * toque simples continua funcionando igual e nada aqui exige movimento
 * (WCAG 2.2 SC 2.5.7 segue atendido).
 */
function useRepeatOnHold(action: () => void) {
  const actionRef = useRef(action);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedUpRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const stop = () => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (speedUpRef.current !== null) {
      clearTimeout(speedUpRef.current);
      speedUpRef.current = null;
    }
  };

  const start = () => {
    stop();
    actionRef.current();
    tickRef.current = setInterval(() => {
      actionRef.current();
    }, REPEAT_MS);
    speedUpRef.current = setTimeout(() => {
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
      }
      tickRef.current = setInterval(() => {
        actionRef.current();
      }, FAST_REPEAT_MS);
    }, ACCELERATE_AFTER_MS);
  };

  useEffect(() => stop, []);

  return { start, stop };
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
    ...type.headline,
  },
  value: {
    ...type.headline,
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
});
