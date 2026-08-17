/**
 * Constantes do aplicativo.
 *
 * Contrato MQTT: docs/mqtt.md (raiz do repositorio). Nao mudar aqui sem mudar la.
 */

/** Identificador do aparelho, igual ao FEEDER_ID do firmware. */
export const FEEDER_ID = 'sp01';

/** Prefixo de topico por aparelho: feeder/<id>. */
export const TOPIC_PREFIX = `feeder/${FEEDER_ID}`;

/**
 * Host do broker pre-preenchido na tela de login.
 * Deixe vazio ate o dominio real existir; o dominio NAO entra no repositorio
 * (mesma regra do firmware, que le de include/secrets.h).
 */
export const DEFAULT_BROKER_HOST = '';

/** Usuario do app no broker, conforme a ACL em infra/mosquitto/acl. */
export const DEFAULT_USERNAME = 'app-giovanni';

/**
 * Caminho do endpoint WebSocket do Mosquitto atras do Traefik.
 * Mosquitto com listener websockets responde em "/" ou "/mqtt" conforme o
 * roteamento; se a conexao falhar com 404, e aqui que se mexe.
 */
export const BROKER_WS_PATH = '/mqtt';

/** Porta unica exposta: 443 (wss). */
export const BROKER_PORT = 443;

/**
 * Keepalive de 45 s nos dois clientes: a Cloudflare derruba WebSocket ocioso
 * perto de 100 s (README do projeto).
 */
export const KEEPALIVE_SECONDS = 45;

/** Reconexao com backoff exponencial entre 1 s e 30 s. */
export const RECONNECT_MIN_MS = 1000;
export const RECONNECT_MAX_MS = 30000;

/** Timeout de conexao antes de considerar o broker inalcancavel. */
export const CONNECT_TIMEOUT_MS = 15000;

/** Limites da dose manual, em gramas (modos com balanca). */
export const GRAMS_MIN = 5;
export const GRAMS_MAX = 200;
export const GRAMS_STEP = 5;
export const GRAMS_DEFAULT = 40;

/**
 * Limites da dose manual, em segundos (modo timer).
 * O teto real e o `max_secs` da config; SECS_MAX e so o teto do teto, para o
 * stepper nunca oferecer um numero que o firmware recusaria.
 */
export const SECS_MIN = 1;
export const SECS_MAX = 120;
export const SECS_STEP = 1;
export const SECS_DEFAULT = 8;

/** Faixas dos ajustes, conforme docs/mqtt.md (v2). */
export const RPM_MIN = 5;
export const RPM_MAX = 60;
export const RPM_STEP = 5;

export const MAX_SECS_MIN = 5;
export const MAX_SECS_MAX = 120;
export const MAX_SECS_STEP = 5;

export const SIREN_SECS_MIN = 1;
export const SIREN_SECS_MAX = 30;
export const SIREN_SECS_STEP = 1;

export const G_PER_S_MIN = 0.5;
export const G_PER_S_MAX = 20;
export const G_PER_S_STEP = 0.5;

/** Peso conhecido usado na calibracao da balanca, em gramas. */
export const KNOWN_WEIGHT_MIN = 50;
export const KNOWN_WEIGHT_MAX = 2000;
export const KNOWN_WEIGHT_STEP = 50;
export const KNOWN_WEIGHT_DEFAULT = 500;

/** Defaults do contrato, usados quando o retained `config` vier incompleto. */
export const CONFIG_DEFAULTS = {
  mode: 'timer',
  rpm: 20,
  defaultSecs: SECS_DEFAULT,
  defaultGrams: GRAMS_DEFAULT,
  maxSecs: 60,
  siren: true,
  sirenSecs: 2,
  gramsPerSecond: 5,
} as const;

/** Maximo de refeicoes na agenda (limite do firmware). */
export const MAX_MEALS = 8;

/** Quantos eventos guardar em memoria na sessao. */
export const MAX_EVENTS_IN_MEMORY = 100;
