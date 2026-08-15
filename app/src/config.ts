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

/** Limites da dose manual, em gramas. */
export const GRAMS_MIN = 5;
export const GRAMS_MAX = 200;
export const GRAMS_STEP = 5;
export const GRAMS_DEFAULT = 40;

/** Maximo de refeicoes na agenda (limite do firmware). */
export const MAX_MEALS = 8;

/** Quantos eventos guardar em memoria na sessao. */
export const MAX_EVENTS_IN_MEMORY = 100;
