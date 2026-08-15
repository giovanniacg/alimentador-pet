import type { ConnectionStatus, FeederEvent, Meal } from '@/feeder/types';

/**
 * Texto que aparece na tela. Portugues simples, sem jargao: quem usa o app
 * sao os pais do Giovanni, nao um operador de broker.
 *
 * Toda funcao aqui e pura e recebe o "agora" por parametro, para o render
 * nunca depender de Date.now() direto (React: componentes devem ser puros).
 */

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

/** "07:00" */
export function formatClock(meal: Pick<Meal, 'h' | 'm'>): string {
  return `${twoDigits(meal.h)}:${twoDigits(meal.m)}`;
}

/** "40 g" */
export function formatGrams(grams: number | null): string {
  if (grams === null) {
    return 'quantidade não informada';
  }
  return `${Math.round(grams)} g`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseIsoDate(iso: string | null): Date | null {
  if (iso === null || iso.trim().length === 0) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "hoje às 07:02", "ontem às 19:00", "12/08 às 19:00". */
export function formatMoment(iso: string | null, now: Date): string {
  const date = parseIsoDate(iso);
  if (date === null) {
    return 'horário desconhecido';
  }
  const clock = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
  if (isSameDay(date, now)) {
    return `hoje às ${clock}`;
  }
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (isSameDay(date, yesterday)) {
    return `ontem às ${clock}`;
  }
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)} às ${clock}`;
}

/** "hoje às 19:00" ou "amanhã às 07:00", conforme o relogio do celular. */
export function formatNextMealMoment(meal: Meal, now: Date): string {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const mealMinutes = meal.h * 60 + meal.m;
  const dayLabel = mealMinutes > nowMinutes ? 'hoje' : 'amanhã';
  return `${dayLabel} às ${formatClock(meal)}`;
}

/** Frase do estado da conexao, ja no tom da tela. */
export function connectionLabel(status: ConnectionStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'Desconectado';
    case 'connecting':
      return 'Conectando...';
    case 'connected':
      return 'Conectado';
    case 'reconnecting':
      return 'Tentando reconectar...';
    case 'error':
      return status.message;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/** Frase do evento no historico. */
export function eventLabel(event: FeederEvent): string {
  switch (event.kind) {
    case 'meal_done':
      return `Comida liberada: ${formatGrams(event.grams)}`;
    case 'meal_failed':
      return event.reason === 'sem_racao'
        ? 'Não conseguiu servir: acabou a ração'
        : 'Não conseguiu servir a comida';
    case 'button_feed':
      return 'Alguém apertou o botão do aparelho';
    case 'unknown':
      return 'Aviso do aparelho';
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** Simbolo textual do evento, para nao depender so de cor. */
export function eventSymbol(event: FeederEvent): string {
  switch (event.kind) {
    case 'meal_done':
      return '✓';
    case 'meal_failed':
      return '!';
    case 'button_feed':
      return '•';
    case 'unknown':
      return '?';
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** "hoje às 07:02, 40 g" para a ultima refeicao. */
export function formatLastMeal(
  lastMeal: { ts: string | null; grams: number | null; ok: boolean | null } | null,
  now: Date
): string {
  if (lastMeal === null) {
    return 'Nenhuma refeição registrada ainda';
  }
  const moment = formatMoment(lastMeal.ts, now);
  const grams = formatGrams(lastMeal.grams);
  if (lastMeal.ok === false) {
    return `${moment}, ${grams} (falhou)`;
  }
  return `${moment}, ${grams}`;
}
