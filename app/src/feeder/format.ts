import type { ConnectionStatus, Dose, FeedMode, FeederEvent, Meal } from '@/feeder/types';

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

/** "8 s" */
export function formatSeconds(secs: number | null): string {
  if (secs === null) {
    return 'tempo não informado';
  }
  return `${Math.round(secs)} s`;
}

/** "8 s" ou "40 g", conforme a unidade da dose. */
export function formatDose(dose: Dose | null): string {
  if (dose === null) {
    return 'quantidade não informada';
  }
  switch (dose.unit) {
    case 'secs':
      return formatSeconds(dose.secs);
    case 'grams':
      return formatGrams(dose.grams);
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

/** "8 s de ração" ou "40 g de ração", para frase corrida. */
export function describeDose(dose: Dose | null): string {
  if (dose === null) {
    return 'quantidade não informada';
  }
  return `${formatDose(dose)} de ração`;
}

/** "5,0 g/s" */
export function formatGramsPerSecond(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} g/s`;
}

/** Nome curto do modo, do jeito que aparece no seletor. */
export function modeLabel(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return 'Por tempo (sem balança)';
    case 'scale_bowl':
      return 'Balança no prato';
    case 'scale_hopper':
      return 'Balança no reservatório';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Explicacao do modo em linguagem de gente. */
export function modeExplanation(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return 'A rosca gira por um tempo certo. É o jeito mais simples e não precisa de balança.';
    case 'scale_bowl':
      return 'A balança fica embaixo do prato. O aparelho serve até o prato ganhar o peso pedido.';
    case 'scale_hopper':
      return 'A balança fica embaixo do reservatório. O aparelho serve até o reservatório perder o peso pedido.';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Rotulo da leitura da balanca, que muda de lugar conforme o modo. */
export function scaleReadingLabel(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return 'Peso';
    case 'scale_bowl':
      return 'Peso no prato';
    case 'scale_hopper':
      return 'Peso no reservatório';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Como a dose e chamada em cada modo, para rotular stepper e botao. */
export function doseFieldLabel(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return 'Tempo de ração';
    case 'scale_bowl':
    case 'scale_hopper':
      return 'Quantidade de ração';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Nome da unidade em voz alta, para leitor de tela. */
export function doseUnitName(mode: FeedMode): string {
  switch (mode) {
    case 'timer':
      return 'tempo de ração em segundos';
    case 'scale_bowl':
    case 'scale_hopper':
      return 'quantidade de ração em gramas';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
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

/** "15/08 às 19:00" para o relogio interno do aparelho. */
export function formatRtc(iso: string | null, now: Date): string {
  return parseIsoDate(iso) === null ? 'não informado' : formatMoment(iso, now);
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
      return `Comida liberada: ${describeDose(event.dose)}`;
    case 'meal_failed':
      return event.reason === 'sem_racao'
        ? 'Não conseguiu servir: acabou a ração'
        : 'Não conseguiu servir a comida';
    case 'button_feed':
      return 'Alguém apertou o botão do aparelho';
    case 'config_changed':
      return 'Os ajustes do aparelho foram alterados';
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
    case 'config_changed':
      return '⚙';
    case 'unknown':
      return '?';
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** "hoje às 07:02, 8 s de ração" para a ultima refeicao. */
export function formatLastMeal(
  lastMeal: { ts: string | null; dose: Dose | null; ok: boolean | null } | null,
  now: Date
): string {
  if (lastMeal === null) {
    return 'Nenhuma refeição registrada ainda';
  }
  const moment = formatMoment(lastMeal.ts, now);
  const amount = describeDose(lastMeal.dose);
  if (lastMeal.ok === false) {
    return `${moment}, ${amount} (falhou)`;
  }
  return `${moment}, ${amount}`;
}
