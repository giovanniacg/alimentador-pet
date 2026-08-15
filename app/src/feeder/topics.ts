import { BROKER_PORT, BROKER_WS_PATH, TOPIC_PREFIX } from '@/config';

/** Topicos do contrato (docs/mqtt.md). */
export const TOPICS = {
  state: `${TOPIC_PREFIX}/state`,
  schedule: `${TOPIC_PREFIX}/schedule`,
  event: `${TOPIC_PREFIX}/event`,
  cmdFeed: `${TOPIC_PREFIX}/cmd/feed`,
  cmdSkip: `${TOPIC_PREFIX}/cmd/skip`,
  cmdSchedule: `${TOPIC_PREFIX}/cmd/schedule`,
  cmdTare: `${TOPIC_PREFIX}/cmd/tare`,
} as const;

/** Topicos que o app assina ao conectar. */
export const SUBSCRIBED_TOPICS: readonly string[] = [TOPICS.state, TOPICS.schedule, TOPICS.event];

/**
 * Monta a URL do broker. O usuario digita so o dominio ("casa.exemplo.com.br");
 * se ele colar a URL inteira, respeitamos o que veio.
 */
export function brokerUrl(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  const withoutSlash = trimmed.replace(/\/+$/, '');
  return `wss://${withoutSlash}:${BROKER_PORT}${BROKER_WS_PATH}`;
}
