import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BigButton } from '@/components/big-button';
import { Screen, useRevealAboveKeyboard } from '@/components/screen';
import { DEFAULT_BROKER_HOST, DEFAULT_USERNAME } from '@/config';
import { useFeeder } from '@/feeder/provider';
import { colors, control, fontCap, fontSizes, iconSize, radius, spacing, type } from '@/theme';

/** Erro por campo. O erro de conexao nao pertence a campo nenhum. */
type FieldErrors = {
  readonly host?: string;
  readonly username?: string;
  readonly password?: string;
};

export default function LoginScreen() {
  const { signIn, lastError } = useFeeder();
  const [host, setHost] = useState(DEFAULT_BROKER_HOST);
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hostRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  /** So o que nao tem campo dono aparece na caixa do topo. */
  const topError = saveError ?? lastError;

  /**
   * Validacao so no envio, e a mensagem nasce junto do campo que falhou.
   * Antes ela nascia no topo da tela: com o teclado aberto ficava fora da
   * area visivel, e o usuario tocava Entrar sem ver nada acontecer.
   */
  const handleSubmit = () => {
    const nextErrors: FieldErrors = {
      host: host.trim().length === 0 ? 'Preencha o endereço do servidor.' : undefined,
      username: username.trim().length === 0 ? 'Preencha o usuário.' : undefined,
      password: password.length === 0 ? 'Preencha a senha.' : undefined,
    };
    setErrors(nextErrors);

    const first =
      nextErrors.host !== undefined
        ? { message: nextErrors.host, ref: hostRef }
        : nextErrors.username !== undefined
          ? { message: nextErrors.username, ref: usernameRef }
          : nextErrors.password !== undefined
            ? { message: nextErrors.password, ref: passwordRef }
            : null;

    if (first !== null) {
      // Focar o campo leva a tela ate ele e anuncia o erro em voz alta.
      first.ref.current?.focus();
      AccessibilityInfo.announceForAccessibility(first.message);
      return;
    }

    setSaveError(null);
    setSaving(true);
    signIn({ host: host.trim(), username: username.trim(), password })
      .catch(() => {
        setSaveError('Não foi possível guardar os dados neste celular.');
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

      {topError === null ? null : (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorSymbol}>!</Text>
          <Text style={styles.errorText}>{topError}</Text>
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
        inputRef={hostRef}
        error={errors.host}
        onNext={() => {
          usernameRef.current?.focus();
        }}
      />

      <Field
        label="Usuário"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        textContentType="username"
        inputRef={usernameRef}
        error={errors.username}
        onNext={() => {
          passwordRef.current?.focus();
        }}
      />

      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry={!showPassword}
        textContentType="password"
        inputRef={passwordRef}
        error={errors.password}
        onSubmitEditing={handleSubmit}>
        {/* Acao auxiliar tem peso de acao auxiliar: controle de linha ancorado
            ao campo, nao um segundo botao do tamanho de "Entrar". */}
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: showPassword }}
          accessibilityLabel="Mostrar a senha"
          onPress={() => {
            setShowPassword((current) => !current);
          }}
          style={styles.showPassword}>
          <MaterialIcons
            name={showPassword ? 'visibility-off' : 'visibility'}
            size={iconSize.sm}
            color={colors.blue}
          />
          <Text style={styles.showPasswordLabel} maxFontSizeMultiplier={fontCap.control}>
            {showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
          </Text>
        </Pressable>
      </Field>

      <BigButton
        label={saving ? 'Entrando...' : 'Entrar'}
        emphasis
        loading={saving}
        style={styles.submit}
        onPress={handleSubmit}
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
  readonly inputRef?: RefObject<TextInput | null>;
  /** Leva o "Enter" do teclado para o proximo campo, sem fechar o teclado. */
  readonly onNext?: () => void;
  readonly error?: string;
  /** Controle ancorado ao campo, como "Mostrar a senha". */
  readonly children?: ReactNode;
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
  inputRef,
  onNext,
  error,
  children,
}: FieldProps) {
  const reveal = useRevealAboveKeyboard();
  const blockRef = useRef<View>(null);
  const invalid = error !== undefined;

  return (
    <View style={styles.field} ref={blockRef}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint === undefined ? null : <Text style={styles.fieldHint}>{hint}</Text>}
      <TextInput
        ref={inputRef}
        style={[styles.input, invalid ? styles.inputInvalid : null]}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        returnKeyType={onNext === undefined ? 'go' : 'next'}
        submitBehavior={onNext === undefined ? 'blurAndSubmit' : 'submit'}
        onSubmitEditing={onNext ?? onSubmitEditing}
        onFocus={() => {
          reveal(blockRef.current);
        }}
        placeholderTextColor={colors.muted}
      />
      {invalid ? (
        <View style={styles.fieldError} accessibilityRole="alert">
          <Text style={styles.fieldErrorSymbol}>!</Text>
          <Text style={styles.fieldErrorText}>{error}</Text>
        </View>
      ) : null}
      {children}
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
  inputInvalid: {
    borderWidth: 3,
    borderColor: colors.red,
  },
  fieldError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  fieldErrorSymbol: {
    ...type.label,
    color: colors.red,
  },
  fieldErrorText: {
    flex: 1,
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.red,
  },
  showPassword: {
    minHeight: control.sm,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  showPasswordLabel: {
    ...type.label,
    color: colors.blue,
    textDecorationLine: 'underline',
  },
  submit: {
    marginTop: spacing.lg,
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
