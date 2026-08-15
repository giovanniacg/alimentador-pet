import '@/polyfills';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeederProvider, useFeeder } from '@/feeder/provider';
import { colors, fontSizes, spacing } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FeederProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </FeederProvider>
    </SafeAreaProvider>
  );
}

/**
 * Porteiro do app: sem credenciais salvas, so existe a tela de login; com
 * credenciais, so existem as abas. `Stack.Protected` faz esse corte sem
 * navegacao imperativa e sem tela piscando no meio.
 */
function RootNavigator() {
  const { loadingCredentials, credentials } = useFeeder();

  if (loadingCredentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Abrindo o aplicativo...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={credentials === null}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={credentials !== null}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
});
