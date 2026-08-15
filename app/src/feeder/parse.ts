import { MAX_MEALS } from '@/config';
import type { FeederEvent, FeederState, LastMeal, Meal } from '@/feeder/types';

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

/** Valida uma refeicao: hora 0-23, minuto 0-59, gramas > 0. */
export function parseMeal(value: unknown): Meal | null {
  if (!isRecord(value)) {
    return null;
  }
  const h = asFiniteNumber(value.h);
  const m = asFiniteNumber(value.m);
  const grams = asFiniteNumber(value.grams);
  if (h === null || m === null || grams === null) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59 || grams <= 0) {
    return null;
  }
  return { h: Math.trunc(h), m: Math.trunc(m), grams: Math.round(grams) };
}

function parseLastMeal(value: unknown): LastMeal | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    ts: asString(value.ts),
    grams: asFiniteNumber(value.grams),
    ok: typeof value.ok === 'boolean' ? value.ok : null,
  };
}

/** Le o topico retained `state`. Aguenta o payload minimo do LWT. */
export function parseState(raw: string): FeederState | null {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return null;
  }
  return {
    online: asBoolean(value.online, false),
    rtc: asString(value.rtc),
    hopperGrams: asFiniteNumber(value.hopper_g),
    lastMeal: parseLastMeal(value.last_meal),
    nextMeal: parseMeal(value.next_meal),
    skipNext: asBoolean(value.skip_next, false),
  };
}

/** Le o topico retained `schedule`, descartando refeicoes invalidas. */
export function parseSchedule(raw: string): Meal[] | null {
  const value = parseJson(raw);
  if (!isRecord(value) || !Array.isArray(value.meals)) {
    return null;
  }
  const meals: Meal[] = [];
  for (const item of value.meals) {
    const meal = parseMeal(item);
    if (meal !== null) {
      meals.push(meal);
    }
  }
  return sortMeals(meals).slice(0, MAX_MEALS);
}

/** Le o topico `event`. Evento desconhecido vira `unknown` com o texto cru. */
export function parseEvent(raw: string): FeederEvent {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return { kind: 'unknown', raw };
  }
  const type = asString(value.type);
  switch (type) {
    case 'meal_done':
      return { kind: 'meal_done', grams: asFiniteNumber(value.grams) };
    case 'meal_failed':
      return { kind: 'meal_failed', reason: asString(value.reason) };
    case 'button_feed':
      return { kind: 'button_feed' };
    default:
      return { kind: 'unknown', raw };
  }
}

/** Ordena por horario do dia. */
export function sortMeals(meals: readonly Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
}

/** Serializa a agenda no formato do comando `cmd/schedule`. */
export function scheduleCommandPayload(meals: readonly Meal[]): { meals: Meal[] } {
  return { meals: sortMeals(meals).slice(0, MAX_MEALS) };
}
