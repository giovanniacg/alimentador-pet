import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { CONFIG_DEFAULTS, GRAMS_DEFAULT, MAX_MEALS, SECS_DEFAULT } from '@/config';
import {
  describeDose,
  doseFieldLabel,
  doseUnitName,
  formatClock,
  formatDose,
  modeLabel,
} from '@/feeder/format';
import {
  clamp,
  doseAmount,
  doseForMode,
  doseLimits,
  doseUnitForMode,
  makeDose,
} from '@/feeder/mode';
import { sortMeals } from '@/feeder/parse';
import { isFeederOnline, useFeeder } from '@/feeder/provider';
import type { Dose, FeedMode, Meal } from '@/feeder/types';
import { MIN_TOUCH, colors, fontSizes, radius, spacing } from '@/theme';

type Editing = {
  /** null quando e uma refeicao nova. */
  readonly index: number | null;
  readonly meal: Meal;
};

function sameDose(a: Dose, b: Dose): boolean {
  return a.unit === b.unit && doseAmount(a) === doseAmount(b);
}

function sameSchedule(a: readonly Meal[], b: readonly Meal[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((meal, index) => {
    const other = b[index];
    if (other === undefined) {
      return false;
    }
    return meal.h === other.h && meal.m === other.m && sameDose(meal.dose, other.dose);
  });
}

export default function AgendaScreen() {
  const { schedule, saveSchedule, status, state, config, mode, gramsPerSecond } = useFeeder();
  /**
   * `draft === null` significa "seguindo o que esta no aparelho". Assim a tela
   * acompanha o topico retained sem copiar estado dentro de um Effect.
   */
  const [draft, setDraft] = useState<readonly Meal[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sending, setSending] = useState(false);

  const deviceMeals: readonly Meal[] = schedule ?? [];
  const meals: readonly Meal[] = draft ?? deviceMeals;
  const pending = draft !== null && !sameSchedule(draft, deviceMeals);
  const online = isFeederOnline(status, state);
  const maxSecs = config?.maxSecs ?? CONFIG_DEFAULTS.maxSecs;

  /** Dose de uma refeicao nova, na unidade do modo vigente. */
  const newDose = (): Dose => {
    const unit = doseUnitForMode(mode);
    return makeDose(
      unit,
      unit === 'secs'
        ? (config?.defaultSecs ?? SECS_DEFAULT)
        : (config?.defaultGrams ?? GRAMS_DEFAULT)
    );
  };

  /** Mostra a dose sempre na medida do modo em uso, convertendo se preciso. */
  const shownDose = (meal: Meal): Dose => doseForMode(meal.dose, mode, gramsPerSecond);

  const openNew = () => {
    if (meals.length >= MAX_MEALS) {
      Alert.alert('Limite alcançado', `O alimentador guarda no máximo ${MAX_MEALS} refeições.`);
      return;
    }
    setEditing({ index: null, meal: { h: 12, m: 0, dose: newDose() } });
  };

  const openEdit = (index: number, meal: Meal) => {
    // O editor trabalha na unidade do modo vigente: converter na abertura evita
    // salvar segundos num aparelho que agora pesa gramas.
    setEditing({ index, meal: { ...meal, dose: shownDose(meal) } });
  };

  const commitEditing = () => {
    if (editing === null) {
      return;
    }
    const next = [...meals];
    if (editing.index === null) {
      next.push(editing.meal);
    } else {
      next[editing.index] = editing.meal;
    }
    setDraft(sortMeals(next));
    setEditing(null);
  };

  const removeMeal = (index: number) => {
    const meal = meals[index];
    if (meal === undefined) {
      return;
    }
    Alert.alert('Apagar este horário?', `Refeição das ${formatClock(meal)}.`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          setDraft(meals.filter((_, position) => position !== index));
        },
      },
    ]);
  };

  const confirmSave = () => {
    Alert.alert(
      'Salvar os horários no alimentador?',
      'A lista inteira vai substituir o que está gravado no aparelho.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Salvar',
          onPress: () => {
            setSending(true);
            saveSchedule(meals)
              .then(() => {
                setDraft(null);
                Alert.alert('Pronto', 'Os horários foram enviados para o alimentador.');
              })
              .catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : 'Não foi possível salvar os horários.';
                Alert.alert('Não deu certo', message);
              })
              .finally(() => {
                setSending(false);
              });
          },
        },
      ]
    );
  };

  return (
    <Screen title="Horários das refeições">
      <Card title="Gravado no alimentador">
        {schedule === null ? (
          <Text style={styles.muted}>Ainda não recebemos os horários do aparelho.</Text>
        ) : deviceMeals.length === 0 ? (
          <Text style={styles.muted}>Nenhum horário gravado.</Text>
        ) : (
          <Text style={styles.muted}>
            {deviceMeals
              .map((meal) => `${formatClock(meal)} (${formatDose(shownDose(meal))})`)
              .join('   ·   ')}
          </Text>
        )}
        <Text style={styles.muted}>{modeHint(mode)}</Text>
      </Card>

      {pending ? (
        <View style={styles.pendingBox} accessibilityRole="alert">
          <Text style={styles.pendingText}>
            Você mexeu na lista. Toque em SALVAR NO ALIMENTADOR para valer de verdade.
          </Text>
        </View>
      ) : null}

      {meals.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            Nenhuma refeição na lista. Toque em Adicionar refeição para criar a primeira.
          </Text>
        </Card>
      ) : (
        meals.map((meal, index) => (
          <MealRow
            key={`${meal.h}-${meal.m}-${index}`}
            meal={meal}
            dose={shownDose(meal)}
            onEdit={() => {
              openEdit(index, meal);
            }}
            onRemove={() => {
              removeMeal(index);
            }}
          />
        ))
      )}

      <BigButton
        label="Adicionar refeição"
        variant="secondary"
        onPress={openNew}
        disabled={meals.length >= MAX_MEALS}
        disabledReason={`O alimentador guarda no máximo ${MAX_MEALS} refeições.`}
      />

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

      <MealEditor
        editing={editing}
        mode={mode}
        maxSecs={maxSecs}
        onChange={setEditing}
        onCancel={() => {
          setEditing(null);
        }}
        onConfirm={commitEditing}
      />
    </Screen>
  );
}

/** Explica, em uma linha, por que a medida da tela e essa. */
function modeHint(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return `Modo em uso: ${modeLabel(mode)}. As refeições são medidas em segundos de ração.`;
    case 'scale_bowl':
    case 'scale_hopper':
      return `Modo em uso: ${modeLabel(mode)}. As refeições são medidas em gramas.`;
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

function MealRow({
  meal,
  dose,
  onEdit,
  onRemove,
}: {
  readonly meal: Meal;
  readonly dose: Dose;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowClock}>{formatClock(meal)}</Text>
        <Text style={styles.rowDose}>{describeDose(dose)}</Text>
      </View>
      <RowButton
        label="Mudar"
        accessibilityLabel={`Mudar refeição das ${formatClock(meal)}`}
        onPress={onEdit}
      />
      <RowButton
        label="Apagar"
        danger
        accessibilityLabel={`Apagar refeição das ${formatClock(meal)}`}
        onPress={onRemove}
      />
    </View>
  );
}

function RowButton({
  label,
  accessibilityLabel,
  onPress,
  danger = false,
}: {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
}) {
  const tone = danger ? colors.red : colors.blue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowButton,
        { borderColor: tone, backgroundColor: pressed ? colors.surface : colors.white },
      ]}>
      <Text style={[styles.rowButtonText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

function MealEditor({
  editing,
  mode,
  maxSecs,
  onChange,
  onCancel,
  onConfirm,
}: {
  readonly editing: Editing | null;
  readonly mode: FeedMode;
  readonly maxSecs: number;
  readonly onChange: (next: Editing) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  if (editing === null) {
    return null;
  }
  const { meal } = editing;
  const unit = doseUnitForMode(mode);
  const limits = doseLimits(unit, maxSecs);
  const dose = makeDose(unit, clamp(doseAmount(meal.dose), limits.min, limits.max));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <Text style={styles.modalTitle} accessibilityRole="header">
            {editing.index === null ? 'Nova refeição' : 'Mudar refeição'}
          </Text>

          <Stepper
            label="Hora"
            value={meal.h}
            display={`${meal.h.toString().padStart(2, '0')} h`}
            min={0}
            max={23}
            step={1}
            wrap
            unitLabel="hora"
            onChange={(h) => {
              onChange({ ...editing, meal: { ...meal, h } });
            }}
          />

          <Stepper
            label="Minuto"
            value={meal.m}
            display={`${meal.m.toString().padStart(2, '0')} min`}
            min={0}
            max={55}
            step={5}
            wrap
            unitLabel="minuto"
            onChange={(m) => {
              onChange({ ...editing, meal: { ...meal, m } });
            }}
          />

          <Stepper
            label={doseFieldLabel(mode)}
            value={doseAmount(dose)}
            display={formatDose(dose)}
            min={limits.min}
            max={limits.max}
            step={limits.step}
            unitLabel={doseUnitName(mode)}
            onChange={(amount) => {
              onChange({ ...editing, meal: { ...meal, dose: makeDose(unit, amount) } });
            }}
          />

          <BigButton label="Guardar na lista" onPress={onConfirm} />
          <BigButton label="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: fontSizes.body,
    color: colors.muted,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  rowInfo: {
    flex: 1,
  },
  rowClock: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
  },
  rowDose: {
    fontSize: fontSizes.body,
    color: colors.muted,
  },
  rowButton: {
    minHeight: MIN_TOUCH,
    minWidth: 88,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  rowButtonText: {
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.text,
  },
});
