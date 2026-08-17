import type { ConnectionStatus, Dose, FeedMode, FeederEvent, Meal, Weekday } from '@/feeder/types';
import { isEveryDay, isWeekday, normalizeDays, sameDays } from '@/feeder/weekdays';

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

/** Nome completo de cada dia, na ordem do contrato (0 = domingo). */
const DAY_NAMES: readonly string[] = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

/** Abreviacao de tres letras, para a lista curta. */
const DAY_SHORT: readonly string[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Letra do chip. Repete D S T Q Q S S, como todo calendario brasileiro. */
const DAY_LETTER: readonly string[] = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Artigo certo: "no domingo", "na terça". */
const DAY_ARTICLE: readonly string[] = ['no', 'na', 'na', 'na', 'na', 'na', 'no'];

function dayText(day: Weekday, table: readonly string[]): string {
  return table[day] ?? '';
}

/** "domingo", "terça". Usado no nome acessível do chip. */
export function dayName(day: Weekday): string {
  return dayText(day, DAY_NAMES);
}

/** "D", "S", "T"... o rótulo curto do chip. */
export function dayLetter(day: Weekday): string {
  return dayText(day, DAY_LETTER);
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * Dias em linguagem de gente: "Todos os dias", "Seg a sex", "Sáb e dom",
 * "Só na terça" ou uma lista curta ("Ter, qui").
 */
export function formatDays(days: readonly Weekday[]): string {
  const ordered = normalizeDays(days);
  if (ordered.length === 0) {
    return 'Nenhum dia escolhido';
  }
  if (isEveryDay(ordered)) {
    return 'Todos os dias';
  }
  if (sameDays(ordered, [1, 2, 3, 4, 5])) {
    return 'Seg a sex';
  }
  if (sameDays(ordered, [0, 6])) {
    return 'Sáb e dom';
  }
  const only = ordered[0];
  if (ordered.length === 1 && only !== undefined) {
    return `Só ${dayText(only, DAY_ARTICLE)} ${dayName(only)}`;
  }
  const parts = ordered.map((day) => dayText(day, DAY_SHORT));
  return capitalize(parts.join(', '));
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

/**
 * "hoje às 19:00", "amanhã às 07:00" ou "na terça às 07:00".
 *
 * Percorre os proximos sete dias a partir de `now` e para no primeiro que
 * esteja em `meal.days`. Comparar so a hora, como era antes, fazia uma
 * refeicao que so acontece na segunda ser anunciada como "hoje" num sabado:
 * o app mentia para quem confia nele para alimentar um animal.
 */
export function formatNextMealMoment(meal: Meal, now: Date): string {
  const clock = formatClock(meal);
  const days = normalizeDays(meal.days);
  if (days.length === 0) {
    return `às ${clock}`;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const mealMinutes = meal.h * 60 + meal.m;

  for (let ahead = 0; ahead < 7; ahead += 1) {
    const date = new Date(now.getTime() + ahead * 24 * 60 * 60 * 1000);
    const weekday = date.getDay();
    if (!isWeekday(weekday) || !days.includes(weekday)) {
      continue;
    }
    // Hoje so vale se a hora ainda nao passou.
    if (ahead === 0 && mealMinutes <= nowMinutes) {
      continue;
    }
    if (ahead === 0) {
      return `hoje às ${clock}`;
    }
    if (ahead === 1) {
      return `amanhã às ${clock}`;
    }
    return `${dayText(weekday, DAY_ARTICLE)} ${dayName(weekday)} às ${clock}`;
  }

  return `às ${clock}`;
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
    case 'siren':
      return event.secs === null ? 'Sirene tocada' : `Sirene tocada (${formatSeconds(event.secs)})`;
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
    case 'siren':
      return '♪';
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
