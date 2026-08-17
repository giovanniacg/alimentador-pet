import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { colors, control, fontCap, spacing, type } from '@/theme';

type SaveBarProps = {
  readonly label: string;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
};

/**
 * Barra de salvar presa ao rodape da tela.
 *
 * Aparece so quando ha rascunho por salvar. Antes disso o botao ficava no fim
 * de uma lista que, com fonte grande, passava de mil dp de rolagem: dava para
 * editar tudo, sair da tela e perder a edicao sem nunca ver o botao. Aqui ele
 * esta sempre na frente, junto da saida ("Descartar"), que e a rota de escape.
 */
export function SaveBar({
  label,
  onSave,
  onDiscard,
  disabled = false,
  disabledReason,
}: SaveBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Descartar as mudanças"
        onPress={onDiscard}
        style={styles.discard}>
        <Text style={styles.discardLabel} maxFontSizeMultiplier={fontCap.control}>
          Descartar
        </Text>
      </Pressable>
      <View style={styles.saveSlot}>
        <BigButton
          label={label}
          emphasis
          onPress={onSave}
          disabled={disabled}
          disabledReason={disabledReason}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  discard: {
    minHeight: control.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  discardLabel: {
    ...type.label,
    color: colors.blue,
  },
  saveSlot: {
    flex: 1,
  },
});
