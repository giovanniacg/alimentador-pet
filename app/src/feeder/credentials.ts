import * as SecureStore from 'expo-secure-store';

import type { Credentials } from '@/feeder/types';

const STORAGE_KEY = 'alimentador.credenciais';

function isCredentials(value: unknown): value is Credentials {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate: Record<string, unknown> = { ...value };
  return (
    typeof candidate.host === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.password === 'string'
  );
}

/** Le as credenciais salvas. Devolve null quando nao ha nada guardado. */
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Guarda as credenciais no armazenamento seguro do sistema. */
export async function saveCredentials(credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(credentials), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

/** Apaga as credenciais (usado no "Sair" e quando a senha e recusada). */
export async function clearCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Nada a fazer: se nao deu pra apagar, o proximo login sobrescreve.
  }
}
