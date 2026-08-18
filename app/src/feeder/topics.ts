import { BROKER_PORT, BROKER_WS_PATH, TOPIC_PREFIX } from '@/config';

/** Topicos do contrato (docs/mqtt.md). */
export const TOPICS = {
  state: `${TOPIC_PREFIX}/state`,
  schedule: `${TOPIC_PREFIX}/schedule`,
  config: `${TOPIC_PREFIX}/config`,
  event: `${TOPIC_PREFIX}/event`,
  cmdFeed: `${TOPIC_PREFIX}/cmd/feed`,
  cmdSkip: `${TOPIC_PREFIX}/cmd/skip`,
  cmdSchedule: `${TOPIC_PREFIX}/cmd/schedule`,
  cmdConfig: `${TOPIC_PREFIX}/cmd/config`,
  cmdSiren: `${TOPIC_PREFIX}/cmd/siren`,
  cmdTare: `${TOPIC_PREFIX}/cmd/tare`,
  cmdCalibrate: `${TOPIC_PREFIX}/cmd/calibrate`,
} as const;

/** Topicos que o app assina ao conectar. */
export const SUBSCRIBED_TOPICS: readonly string[] = [
  TOPICS.state,
  TOPICS.schedule,
  TOPICS.config,
  TOPICS.event,
];

/**
 * Deixa o campo "endereco do servidor" no formato dominio puro, aceitando o
 * que gente de verdade cola ali: "https://casa.com", "casa.com/", espacos.
 * Sem isso, "https://casa.com" virava wss://https://... e o Android tentava
 * resolver um host chamado "https" (bug real de 2026-08-18, achado em campo).
 */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^[a-z]+:\/\//i, '')  // https://, wss://, o que vier
    .replace(/\/.*$/, '')          // caminho e barras finais
    .replace(/:\d+$/, '')          // porta digitada (a nossa e fixa, 443)
    .toLowerCase();
}

/**
 * Monta a URL do broker a partir do dominio ja normalizado. Quem digitou URL
 * websocket completa (ws:// ou wss://) tem o valor respeitado.
 */
export function brokerUrl(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  return `wss://${normalizeHost(trimmed)}:${BROKER_PORT}${BROKER_WS_PATH}`;
}
