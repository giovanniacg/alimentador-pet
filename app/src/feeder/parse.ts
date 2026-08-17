import {
  CONFIG_DEFAULTS,
  GRAMS_MAX,
  GRAMS_MIN,
  G_PER_S_MAX,
  G_PER_S_MIN,
  MAX_MEALS,
  MAX_SECS_MAX,
  MAX_SECS_MIN,
  RPM_MAX,
  RPM_MIN,
  SIREN_SECS_MAX,
  SIREN_SECS_MIN,
} from '@/config';
import { clamp, doseUnitForMode } from '@/feeder/mode';
import { ALL_DAYS, isEveryDay, isWeekday, normalizeDays } from '@/feeder/weekdays';
import type {
  ConfigPatch,
  Dose,
  FeedMode,
  FeederConfig,
  FeederEvent,
  FeederState,
  LastMeal,
  Meal,
  Weekday,
} from '@/feeder/types';

/**
 * Tudo que chega do broker e `unknown` ate prova em contrario: um payload
 * malformado nao pode derrubar o app na mao de quem so quer alimentar o gato.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Numero dentro da faixa, ou o default quando vier ausente/torto. */
function asRanged(value: unknown, min: number, max: number, fallback: number): number {
  const raw = asFiniteNumber(value);
  return raw === null ? fallback : clamp(raw, min, max);
}

/** JSON.parse que devolve `unknown` em vez de `any`, e null quando o texto nao e JSON. */
export function parseJson(raw: string): unknown {
  if (raw.trim().length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

/** Type guard do modo: string qualquer nao vira FeedMode sem passar por aqui. */
export function isFeedMode(value: unknown): value is FeedMode {
  return value === 'timer' || value === 'scale_bowl' || value === 'scale_hopper';
}

/** Le o modo de um payload; null quando ausente ou desconhecido. */
export function parseMode(value: unknown): FeedMode | null {
  return isFeedMode(value) ? value : null;
}

/**
 * Le a dose de um objeto que pode trazer `secs` (timer) ou `grams` (balanca).
 *
 * Desempate quando vierem os dois: vale o campo do MODO ATIVO e o outro e
 * ignorado (docs/mqtt.md v2). Por isso o chamador passa a unidade preferida;
 * sem saber o modo, o fallback e `secs`, que e como a v1 sai de fabrica.
 */
export function parseDose(
  value: Record<string, unknown>,
  preferred: Dose['unit'] = 'secs'
): Dose | null {
  const secs = asFiniteNumber(value.secs);
  const grams = asFiniteNumber(value.grams);
  const hasSecs = secs !== null && secs > 0;
  const hasGrams = grams !== null && grams > 0;
  if (hasSecs && hasGrams) {
    return preferred === 'grams'
      ? { unit: 'grams', grams: Math.round(grams) }
      : { unit: 'secs', secs: Math.round(secs) };
  }
  if (hasSecs) {
    return { unit: 'secs', secs: Math.round(secs) };
  }
  if (hasGrams) {
    return { unit: 'grams', grams: Math.round(grams) };
  }
  return null;
}

/**
 * Le os dias em que a refeicao vale.
 *
 * Campo ausente ou que nao e lista significa a semana toda, como manda o
 * contrato. Lista presente mas sem nenhum dia valido devolve vazio, e quem
 * chama descarta a refeicao: um horario que nunca acontece nao pode aparecer
 * na tela como "todos os dias".
 */
export function parseDays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) {
    return [...ALL_DAYS];
  }
  const days: Weekday[] = [];
  for (const item of value) {
    if (isWeekday(item)) {
      days.push(item);
    }
  }
  return normalizeDays(days);
}

/** Valida uma refeicao: hora 0-23, minuto 0-59, dose positiva e ao menos um dia. */
export function parseMeal(value: unknown, preferred?: Dose['unit']): Meal | null {
  if (!isRecord(value)) {
    return null;
  }
  const h = asFiniteNumber(value.h);
  const m = asFiniteNumber(value.m);
  const dose = parseDose(value, preferred);
  if (h === null || m === null || dose === null) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  const days = parseDays(value.days);
  if (days.length === 0) {
    return null;
  }
  return { h: Math.trunc(h), m: Math.trunc(m), dose, days };
}

function parseLastMeal(value: unknown, preferred?: Dose['unit']): LastMeal | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    ts: asString(value.ts),
    dose: parseDose(value, preferred),
    ok: typeof value.ok === 'boolean' ? value.ok : null,
  };
}

/** Le o topico retained `state`. Aguenta o payload minimo do LWT. */
export function parseState(raw: string): FeederState | null {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return null;
  }
  // O proprio payload diz o modo, entao o desempate secs/grams sai daqui
  // mesmo, sem depender do que o app achava que estava valendo.
  const mode = parseMode(value.mode);
  const preferred = mode === null ? undefined : doseUnitForMode(mode);
  return {
    online: asBoolean(value.online, false),
    rtc: asString(value.rtc),
    mode,
    scaleGrams: asFiniteNumber(value.scale_g),
    lastMeal: parseLastMeal(value.last_meal, preferred),
    nextMeal: parseMeal(value.next_meal, preferred),
    skipNext: asBoolean(value.skip_next, false),
    version: asString(value.version) ?? asString(value.fw),
  };
}

/**
 * Le o topico retained `config`.
 *
 * Campo ausente ou fora da faixa cai no default do contrato: melhor a tela de
 * ajustes mostrar o valor de fabrica do que um campo vazio para o Giovanni
 * adivinhar de longe.
 */
export function parseConfig(raw: string): FeederConfig | null {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return null;
  }
  const maxSecs = asRanged(value.max_secs, MAX_SECS_MIN, MAX_SECS_MAX, CONFIG_DEFAULTS.maxSecs);
  return {
    mode: parseMode(value.mode) ?? CONFIG_DEFAULTS.mode,
    rpm: Math.round(asRanged(value.rpm, RPM_MIN, RPM_MAX, CONFIG_DEFAULTS.rpm)),
    defaultSecs: Math.round(asRanged(value.default_secs, 1, maxSecs, CONFIG_DEFAULTS.defaultSecs)),
    defaultGrams: Math.round(
      asRanged(value.default_grams, GRAMS_MIN, GRAMS_MAX, CONFIG_DEFAULTS.defaultGrams)
    ),
    maxSecs: Math.round(maxSecs),
    siren: asBoolean(value.siren, CONFIG_DEFAULTS.siren),
    sirenSecs: Math.round(
      asRanged(value.siren_secs, SIREN_SECS_MIN, SIREN_SECS_MAX, CONFIG_DEFAULTS.sirenSecs)
    ),
    gramsPerSecond: asRanged(
      value.g_per_s,
      G_PER_S_MIN,
      G_PER_S_MAX,
      CONFIG_DEFAULTS.gramsPerSecond
    ),
  };
}

/**
 * Le o topico retained `schedule`, descartando refeicoes invalidas.
 * `preferred` e a unidade do modo ativo, para o desempate secs/grams.
 */
export function parseSchedule(raw: string, preferred?: Dose['unit']): Meal[] | null {
  const value = parseJson(raw);
  if (!isRecord(value) || !Array.isArray(value.meals)) {
    return null;
  }
  const meals: Meal[] = [];
  for (const item of value.meals) {
    const meal = parseMeal(item, preferred);
    if (meal !== null) {
      meals.push(meal);
    }
  }
  return sortMeals(meals).slice(0, MAX_MEALS);
}

/** Le o topico `event`. Evento desconhecido vira `unknown` com o texto cru. */
export function parseEvent(raw: string, preferred?: Dose['unit']): FeederEvent {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return { kind: 'unknown', raw };
  }
  const type = asString(value.type);
  switch (type) {
    case 'meal_done':
      return { kind: 'meal_done', dose: parseDose(value, preferred) };
    case 'meal_failed':
      return { kind: 'meal_failed', reason: asString(value.reason) };
    case 'button_feed':
      return { kind: 'button_feed' };
    case 'siren':
      return { kind: 'siren', secs: asFiniteNumber(value.secs) };
    case 'config_changed':
      return { kind: 'config_changed' };
    default:
      return { kind: 'unknown', raw };
  }
}

/** Ordena por horario do dia. */
export function sortMeals(meals: readonly Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
}

/** Campo da dose no formato do contrato: `{secs}` ou `{grams}`. */
export function dosePayload(dose: Dose): { secs: number } | { grams: number } {
  switch (dose.unit) {
    case 'secs':
      return { secs: dose.secs };
    case 'grams':
      return { grams: dose.grams };
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

/**
 * Uma refeicao no formato do contrato. `days` so entra quando a refeicao NAO
 * vale a semana toda: omitido ja significa todos os dias, e mandar a lista
 * cheia seria ruido no payload.
 */
export function mealPayload(meal: Meal): Record<string, unknown> {
  const base: Record<string, unknown> = { h: meal.h, m: meal.m, ...dosePayload(meal.dose) };
  if (!isEveryDay(meal.days)) {
    base.days = normalizeDays(meal.days);
  }
  return base;
}

/** Serializa a agenda no formato do comando `cmd/schedule`. */
export function scheduleCommandPayload(meals: readonly Meal[]): {
  meals: Record<string, unknown>[];
} {
  return { meals: sortMeals(meals).slice(0, MAX_MEALS).map(mealPayload) };
}

/**
 * Serializa so o que mudou para o `cmd/config`: campo omitido fica como esta
 * no aparelho (docs/mqtt.md v2). Escrever a config inteira arriscaria
 * sobrescrever ajuste feito por outra ponta entre a leitura e o envio.
 */
export function configCommandPayload(patch: ConfigPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.mode !== undefined) {
    payload.mode = patch.mode;
  }
  if (patch.rpm !== undefined) {
    payload.rpm = patch.rpm;
  }
  if (patch.defaultSecs !== undefined) {
    payload.default_secs = patch.defaultSecs;
  }
  if (patch.defaultGrams !== undefined) {
    payload.default_grams = patch.defaultGrams;
  }
  if (patch.maxSecs !== undefined) {
    payload.max_secs = patch.maxSecs;
  }
  if (patch.siren !== undefined) {
    payload.siren = patch.siren;
  }
  if (patch.sirenSecs !== undefined) {
    payload.siren_secs = patch.sirenSecs;
  }
  if (patch.gramsPerSecond !== undefined) {
    payload.g_per_s = patch.gramsPerSecond;
  }
  return payload;
}

/** Campos em que o rascunho da tela de ajustes difere do que esta no aparelho. */
export function configDiff(draft: FeederConfig, device: FeederConfig): ConfigPatch {
  const patch: ConfigPatch = {};
  const keys: readonly (keyof FeederConfig)[] = [
    'mode',
    'rpm',
    'defaultSecs',
    'defaultGrams',
    'maxSecs',
    'siren',
    'sirenSecs',
    'gramsPerSecond',
  ];
  for (const key of keys) {
    if (draft[key] !== device[key]) {
      Object.assign(patch, { [key]: draft[key] });
    }
  }
  return patch;
}
