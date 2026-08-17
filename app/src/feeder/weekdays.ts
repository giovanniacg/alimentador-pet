import type { Weekday } from '@/feeder/types';

/** Semana inteira, na ordem do contrato: 0 = domingo ... 6 = sabado. */
export const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const WEEKDAY_SET: ReadonlySet<number> = new Set(ALL_DAYS);

/** Type guard do dia da semana: numero solto nao vira Weekday sem passar aqui. */
export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && WEEKDAY_SET.has(value);
}

/** Ordena e tira repetido, para a comparacao e o payload serem estaveis. */
export function normalizeDays(days: readonly Weekday[]): Weekday[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

export function isEveryDay(days: readonly Weekday[]): boolean {
  return new Set(days).size === ALL_DAYS.length;
}

export function hasDay(days: readonly Weekday[], day: Weekday): boolean {
  return days.includes(day);
}

/** Liga ou desliga um dia. Um toque, sem arrastar (WCAG 2.2 SC 2.5.7). */
export function toggleDay(days: readonly Weekday[], day: Weekday): Weekday[] {
  return hasDay(days, day)
    ? days.filter((current) => current !== day)
    : normalizeDays([...days, day]);
}

export function sameDays(a: readonly Weekday[], b: readonly Weekday[]): boolean {
  const left = normalizeDays(a);
  const right = normalizeDays(b);
  return left.length === right.length && left.every((day, index) => day === right[index]);
}
