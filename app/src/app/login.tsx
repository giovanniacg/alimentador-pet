import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Screen, useRevealAboveKeyboard } from '@/components/screen';
import { DEFAULT_BROKER_HOST, DEFAULT_USERNAME } from '@/config';
import { useFeeder } from '@/feeder/provider';
import { colors, control, fontSizes, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const { signIn, lastError } = useFeeder();
  const [host, setHost] = useState(DEFAULT_BROKER_HOST);
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const errorMessage = formError ?? lastError;

  const handleSubmit = () => {
    if (host.trim().length === 0) {
      setFormError('Preencha o endereço do servidor.');
      return;
    }
    if (username.trim().length === 0 || password.length === 0) {
      setFormError('Preencha o usuário e a senha.');
      return;
    }
    setFormError(null);
    setSaving(true);
    signIn({ host: host.trim(), username: username.trim(), password })
      .catch(() => {
        setFormError('Não foi possível guardar os dados neste celular.');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <Screen title="Alimentador do pet" avoidKeyboard>
      <Text style={styles.intro}>
        Preencha os dados uma vez. Depois disso o aplicativo entra sozinho.
      </Text>

      {errorMessage === null ? null : (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorSymbol}>!</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Field
        label="Endereço do servidor"
        hint="Foi anotado junto com a senha. Exemplo: casa.meusite.com.br"
        value={host}
        onChangeText={setHost}
        autoCapitalize="none"
        keyboardType="url"
        textContentType="URL"
      />

      <Field
        label="Usuário"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        textContentType="username"
      />

      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry={!showPassword}
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />

      <BigButton
        label={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
        variant="secondary"
        onPress={() => {
          setShowPassword((current) => !current);
        }}
      />

      <BigButton
        label={saving ? 'Entrando...' : 'Entrar'}
        onPress={handleSubmit}
        disabled={saving}
        disabledReason={saving ? 'Só um instante.' : undefined}
      />
    </Screen>
  );
}

type FieldProps = {
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly autoCapitalize?: 'none' | 'sentences';
  readonly keyboardType?: 'default' | 'url';
  readonly secureTextEntry?: boolean;
  readonly textContentType?: 'URL' | 'username' | 'password';
  readonly onSubmitEditing?: () => void;
};

function Field({
  label,
  hint,
  value,
  onChangeText,
  autoCapitalize = 'none',
  keyboardType = 'default',
  secureTextEntry = false,
  textContentType,
  onSubmitEditing,
}: FieldProps) {
  const reveal = useRevealAboveKeyboard();
  const blockRef = useRef<View>(null);

  return (
    <View style={styles.field} ref={blockRef}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint === undefined ? null : <Text style={styles.fieldHint}>{hint}</Text>}
      <TextInput
        style={styles.input}
        onFocus={() => {
          reveal(blockRef.current);
        }}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        onSubmitEditing={onSubmitEditing}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSizes.body,
    fontWeight: '700',
    color: colors.text,
  },
  fieldHint: {
    fontSize: fontSizes.small,
    color: colors.muted,
  },
  input: {
    minHeight: control.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.redSurface,
    borderColor: colors.red,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorSymbol: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.red,
  },
  errorText: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.text,
  },
});
