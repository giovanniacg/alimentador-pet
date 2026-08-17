import { GRAMS_MAX, GRAMS_MIN, SECS_MAX, SECS_MIN } from '@/config';
import type { Dose, FeedMode } from '@/feeder/types';

/**
 * Regras puras de modo e dose. Nada de texto de tela aqui (isso e format.ts) e
 * nada de MQTT: so a matematica que o app e o firmware precisam concordar.
 */

/** Unidade da dose em cada modo. Fecho `never` para nao esquecer modo novo. */
export function doseUnitForMode(mode: FeedMode): Dose['unit'] {
  switch (mode) {
    case 'timer':
      return 'secs';
    case 'scale_bowl':
    case 'scale_hopper':
      return 'grams';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** True nos modos que dependem da celula de carga. */
export function isScaleMode(mode: FeedMode): boolean {
  return doseUnitForMode(mode) === 'grams';
}

/** Numero cru da dose, sem unidade. */
export function doseAmount(dose: Dose): number {
  switch (dose.unit) {
    case 'secs':
      return dose.secs;
    case 'grams':
      return dose.grams;
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

/** Monta a dose na unidade pedida, arredondando como o firmware espera. */
export function makeDose(unit: Dose['unit'], amount: number): Dose {
  switch (unit) {
    case 'secs':
      return { unit: 'secs', secs: Math.max(1, Math.round(amount)) };
    case 'grams':
      return { unit: 'grams', grams: Math.max(1, Math.round(amount)) };
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

/**
 * Converte a dose para outra unidade pelo fator `g_per_s`.
 *
 * Mesma conta que o firmware faz quando recebe o campo errado para o modo
 * ativo (docs/mqtt.md, v2): manter as duas pontas iguais evita o app mostrar
 * um numero e o prato receber outro.
 */
export function convertDose(dose: Dose, unit: Dose['unit'], gramsPerSecond: number): Dose {
  if (dose.unit === unit) {
    return dose;
  }
  const factor = gramsPerSecond > 0 ? gramsPerSecond : 1;
  switch (unit) {
    case 'secs':
      return makeDose('secs', doseAmount(dose) / factor);
    case 'grams':
      return makeDose('grams', doseAmount(dose) * factor);
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

/** Dose na unidade do modo vigente, convertendo quando preciso. */
export function doseForMode(dose: Dose, mode: FeedMode, gramsPerSecond: number): Dose {
  return convertDose(dose, doseUnitForMode(mode), gramsPerSecond);
}

/** Faixa aceita pelo stepper de dose na unidade dada. */
export function doseLimits(
  unit: Dose['unit'],
  maxSecs: number
): { readonly min: number; readonly max: number; readonly step: number } {
  switch (unit) {
    case 'secs':
      return { min: SECS_MIN, max: Math.min(maxSecs, SECS_MAX), step: 1 };
    case 'grams':
      return { min: GRAMS_MIN, max: GRAMS_MAX, step: 5 };
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

/** Prende o valor na faixa e no passo, para o app nunca publicar fora do contrato. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
