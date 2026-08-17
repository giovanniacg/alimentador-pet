import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  CONFIG_DEFAULTS,
  CONNECT_TIMEOUT_MS,
  KEEPALIVE_SECONDS,
  MAX_EVENTS_IN_MEMORY,
  RECONNECT_MAX_MS,
  RECONNECT_MIN_MS,
  SIREN_SECS_MAX,
  SIREN_SECS_MIN,
} from '@/config';
import { clearCredentials, loadCredentials, saveCredentials } from '@/feeder/credentials';
import { clamp, doseUnitForMode } from '@/feeder/mode';
import {
  configCommandPayload,
  dosePayload,
  parseConfig,
  parseEvent,
  parseSchedule,
  parseState,
  scheduleCommandPayload,
} from '@/feeder/parse';
import { SUBSCRIBED_TOPICS, TOPICS, brokerUrl } from '@/feeder/topics';
import type {
  ConfigPatch,
  ConnectionStatus,
  Credentials,
  Dose,
  FeedMode,
  FeederConfig,
  FeederEventEntry,
  FeederState,
  Meal,
} from '@/feeder/types';

/**
 * Toda a conversa com o broker mora aqui. As telas nunca tocam no cliente
 * MQTT: elas leem estado e chamam comandos pelo hook `useFeeder`.
 */

type FeederContextValue = {
  /** True enquanto lemos as credenciais salvas na abertura do app. */
  readonly loadingCredentials: boolean;
  readonly credentials: Credentials | null;
  readonly status: ConnectionStatus;
  /** Mensagem do ultimo erro que derrubou a sessao (senha errada, por exemplo). */
  readonly lastError: string | null;
  readonly state: FeederState | null;
  readonly schedule: readonly Meal[] | null;
  /** Config vigente do aparelho; null enquanto o retained nao chegou. */
  readonly config: FeederConfig | null;
  /**
   * Modo em vigor para a interface inteira. Vem do `state` (que o firmware
   * republica a cada 60 s), cai para a config e, sem nenhum dos dois, assume
   * `timer`, que e como a v1 sai de fabrica.
   */
  readonly mode: FeedMode;
  /** Fator de conversao entre segundos e gramas, com o default do contrato. */
  readonly gramsPerSecond: number;
  readonly events: readonly FeederEventEntry[];
  signIn(credentials: Credentials): Promise<void>;
  signOut(): Promise<void>;
  feedNow(dose: Dose): Promise<void>;
  skipNextMeal(): Promise<void>;
  saveSchedule(meals: readonly Meal[]): Promise<void>;
  /** Publica so os campos alterados em `cmd/config`. */
  saveConfig(patch: ConfigPatch): Promise<void>;
  /** Toca so a sirene, sem dosar. Sem `secs`, vale o `siren_secs` da config. */
  soundSiren(secs?: number): Promise<void>;
  tare(): Promise<void>;
  calibrate(knownGrams: number): Promise<void>;
  clearEvents(): void;
};

const FeederContext = createContext<FeederContextValue | null>(null);

/**
 * Tudo que pertence a uma conexao vive junto e carimbado com o dono
 * (`owner` = as credenciais que abriram a sessao). Assim, quando as
 * credenciais mudam, o estado antigo e descartado no proprio render, sem
 * precisar de setState dentro do Effect (React: "You Might Not Need an Effect").
 */
type Session = {
  readonly owner: Credentials | null;
  readonly status: ConnectionStatus;
  readonly state: FeederState | null;
  readonly schedule: readonly Meal[] | null;
  readonly config: FeederConfig | null;
};

function emptySession(owner: Credentials | null): Session {
  return {
    owner,
    status: owner === null ? { kind: 'idle' } : { kind: 'connecting' },
    state: null,
    schedule: null,
    config: null,
  };
}

function isAuthError(error: Error): boolean {
  return /not authorized|bad user ?name|bad username|unauthorized/i.test(error.message);
}

function friendlyError(error: Error): string {
  if (isAuthError(error)) {
    return 'Usuário ou senha não conferem.';
  }
  return 'Não foi possível falar com o servidor. Confira o endereço e a internet.';
}

function randomClientId(username: string): string {
  const suffix = Math.random().toString(16).slice(2, 8);
  return `${username}-app-${suffix}`;
}

export function FeederProvider({ children }: { children: ReactNode }) {
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [storedSession, setStoredSession] = useState<Session>(() => emptySession(null));
  const [events, setEvents] = useState<readonly FeederEventEntry[]>([]);

  // Sessao valida agora: a guardada, se pertencer as credenciais atuais.
  const session: Session =
    storedSession.owner === credentials ? storedSession : emptySession(credentials);
  const { status, state, schedule, config } = session;

  // Valores derivados no proprio render, sem Effect nem estado espelhado
  // (React: "You Might Not Need an Effect").
  const mode: FeedMode = state?.mode ?? config?.mode ?? CONFIG_DEFAULTS.mode;
  const gramsPerSecond = config?.gramsPerSecond ?? CONFIG_DEFAULTS.gramsPerSecond;

  const clientRef = useRef<MqttClient | null>(null);
  const eventSeq = useRef(0);
  /**
   * Ultimo modo conhecido, para desempatar payload que traga `secs` E `grams`
   * (docs/mqtt.md v2: vale o campo do modo ativo). Fica em ref porque quem
   * precisa dele e o callback de mensagem, nao o render. Se o `schedule`
   * chegar antes do `state`, o desempate cai em `timer`, o default da v1.
   */
  const stateModeRef = useRef<FeedMode | null>(null);
  const configModeRef = useRef<FeedMode | null>(null);

  // Auto-login: le o que ficou guardado no expo-secure-store.
  useEffect(() => {
    let active = true;
    loadCredentials()
      .then((stored) => {
        if (!active) {
          return;
        }
        setCredentials(stored);
        setLoadingCredentials(false);
      })
      .catch(() => {
        if (active) {
          setLoadingCredentials(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Conexao com o broker. Refaz sempre que as credenciais mudam.
  useEffect(() => {
    const owner = credentials;
    if (owner === null) {
      return;
    }

    let attempt = 0;
    let closedByUs = false;

    /** Atualiza a sessao sem nunca ressuscitar estado de credencial antiga. */
    const patch = (change: (current: Session) => Session) => {
      setStoredSession((previous) =>
        change(previous.owner === owner ? previous : emptySession(owner))
      );
    };
    const setStatus = (next: ConnectionStatus) => {
      patch((current) => ({ ...current, status: next }));
    };

    const options: IClientOptions = {
      username: owner.username,
      password: owner.password,
      clientId: randomClientId(owner.username),
      protocolVersion: 4,
      clean: true,
      keepalive: KEEPALIVE_SECONDS,
      reconnectPeriod: RECONNECT_MIN_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
      resubscribe: true,
    };

    const client = mqtt.connect(brokerUrl(owner.host), options);
    clientRef.current = client;

    client.on('connect', () => {
      attempt = 0;
      client.options.reconnectPeriod = RECONNECT_MIN_MS;
      setStatus({ kind: 'connected' });
      setLastError(null);
      client.subscribe([...SUBSCRIBED_TOPICS], { qos: 1 }, (error) => {
        if (error !== null) {
          setStatus({ kind: 'error', message: 'Conectado, mas sem receber o estado do aparelho.' });
        }
      });
    });

    client.on('reconnect', () => {
      attempt += 1;
      // Backoff exponencial: 1s, 2s, 4s... ate 30s. A mqtt.js le
      // options.reconnectPeriod a cada tentativa, entao da pra ajustar aqui.
      client.options.reconnectPeriod = Math.min(
        RECONNECT_MIN_MS * 2 ** (attempt - 1),
        RECONNECT_MAX_MS
      );
      setStatus({ kind: 'reconnecting', attempt });
    });

    client.on('error', (error: Error) => {
      const message = friendlyError(error);
      if (isAuthError(error)) {
        // Senha recusada: nao adianta insistir. Volta pro login.
        closedByUs = true;
        client.end(true);
        setLastError(message);
        void clearCredentials();
        setCredentials(null);
        return;
      }
      setStatus({ kind: 'error', message });
    });

    client.on('close', () => {
      if (!closedByUs) {
        patch((current) =>
          current.status.kind === 'error'
            ? current
            : { ...current, status: { kind: 'reconnecting', attempt } }
        );
      }
    });

    const preferredUnit = () =>
      doseUnitForMode(stateModeRef.current ?? configModeRef.current ?? CONFIG_DEFAULTS.mode);

    client.on('message', (topic: string, payload: { toString(): string }) => {
      const raw = payload.toString();
      if (topic === TOPICS.state) {
        const parsed = parseState(raw);
        stateModeRef.current = parsed?.mode ?? null;
        patch((current) => ({ ...current, state: parsed }));
        return;
      }
      if (topic === TOPICS.schedule) {
        const meals = parseSchedule(raw, preferredUnit());
        patch((current) => ({ ...current, schedule: meals }));
        return;
      }
      if (topic === TOPICS.config) {
        const parsed = parseConfig(raw);
        configModeRef.current = parsed?.mode ?? null;
        patch((current) => ({ ...current, config: parsed }));
        return;
      }
      if (topic === TOPICS.event) {
        eventSeq.current += 1;
        const entry: FeederEventEntry = {
          id: `${Date.now()}-${eventSeq.current}`,
          receivedAt: new Date(),
          event: parseEvent(raw, preferredUnit()),
        };
        setEvents((current) => [entry, ...current].slice(0, MAX_EVENTS_IN_MEMORY));
      }
    });

    return () => {
      closedByUs = true;
      clientRef.current = null;
      client.removeAllListeners();
      client.end(true);
    };
  }, [credentials]);

  const publish = useCallback(async (topic: string, payload: unknown): Promise<void> => {
    const client = clientRef.current;
    if (client === null || !client.connected) {
      throw new Error('Sem conexão com o servidor. Tente de novo em alguns segundos.');
    }
    await new Promise<void>((resolve, reject) => {
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
        if (error !== undefined && error !== null) {
          reject(new Error('O comando não chegou no aparelho. Tente de novo.'));
          return;
        }
        resolve();
      });
    });
  }, []);

  const signIn = useCallback(async (next: Credentials): Promise<void> => {
    setLastError(null);
    await saveCredentials(next);
    setCredentials(next);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await clearCredentials();
    setCredentials(null);
    setEvents([]);
    setLastError(null);
  }, []);

  const feedNow = useCallback(
    (dose: Dose) => publish(TOPICS.cmdFeed, dosePayload(dose)),
    [publish]
  );

  const skipNextMeal = useCallback(() => publish(TOPICS.cmdSkip, {}), [publish]);

  const saveSchedule = useCallback(
    (meals: readonly Meal[]) => publish(TOPICS.cmdSchedule, scheduleCommandPayload(meals)),
    [publish]
  );

  const saveConfig = useCallback(
    async (patch: ConfigPatch): Promise<void> => {
      const payload = configCommandPayload(patch);
      if (Object.keys(payload).length === 0) {
        return;
      }
      await publish(TOPICS.cmdConfig, payload);
    },
    [publish]
  );

  const soundSiren = useCallback(
    (secs?: number) =>
      publish(
        TOPICS.cmdSiren,
        secs === undefined
          ? {}
          : { secs: Math.round(clamp(secs, SIREN_SECS_MIN, SIREN_SECS_MAX)) }
      ),
    [publish]
  );

  const tare = useCallback(() => publish(TOPICS.cmdTare, {}), [publish]);

  const calibrate = useCallback(
    (knownGrams: number) => publish(TOPICS.cmdCalibrate, { known_g: Math.round(knownGrams) }),
    [publish]
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const value = useMemo<FeederContextValue>(
    () => ({
      loadingCredentials,
      credentials,
      status,
      lastError,
      state,
      schedule,
      config,
      mode,
      gramsPerSecond,
      events,
      signIn,
      signOut,
      feedNow,
      skipNextMeal,
      saveSchedule,
      saveConfig,
      soundSiren,
      tare,
      calibrate,
      clearEvents,
    }),
    [
      loadingCredentials,
      credentials,
      status,
      lastError,
      state,
      schedule,
      config,
      mode,
      gramsPerSecond,
      events,
      signIn,
      signOut,
      feedNow,
      skipNextMeal,
      saveSchedule,
      saveConfig,
      soundSiren,
      tare,
      calibrate,
      clearEvents,
    ]
  );

  return <FeederContext.Provider value={value}>{children}</FeederContext.Provider>;
}

/** Acesso ao estado e aos comandos do alimentador. */
export function useFeeder(): FeederContextValue {
  const value = useContext(FeederContext);
  if (value === null) {
    throw new Error('useFeeder precisa estar dentro de <FeederProvider>.');
  }
  return value;
}

/**
 * O aparelho so conta como "ligado" quando estamos conectados ao broker E o
 * estado retido diz online. Sem conexao, o retained pode estar velho.
 */
export function isFeederOnline(status: ConnectionStatus, state: FeederState | null): boolean {
  return status.kind === 'connected' && state !== null && state.online;
}
