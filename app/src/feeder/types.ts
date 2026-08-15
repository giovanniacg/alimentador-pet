/** Uma refeicao agendada: hora, minuto e gramas. */
export type Meal = {
  readonly h: number;
  readonly m: number;
  readonly grams: number;
};

/** Ultima refeicao entregue, como vem no topico state. */
export type LastMeal = {
  readonly ts: string | null;
  readonly grams: number | null;
  readonly ok: boolean | null;
};

/**
 * Estado do alimentador (topico retained `state`).
 *
 * Todo campo fora de `online` e opcional de proposito: o LWT publica apenas
 * `{"online":false}` retained quando o firmware cai, entao o app precisa
 * aguentar um state sem nenhum outro campo.
 */
export type FeederState = {
  readonly online: boolean;
  readonly rtc: string | null;
  readonly hopperGrams: number | null;
  readonly lastMeal: LastMeal | null;
  readonly nextMeal: Meal | null;
  readonly skipNext: boolean;
};

/** Evento pontual (topico `event`, sem retained). */
export type FeederEvent =
  | { readonly kind: 'meal_done'; readonly grams: number | null }
  | { readonly kind: 'meal_failed'; readonly reason: string | null }
  | { readonly kind: 'button_feed' }
  | { readonly kind: 'unknown'; readonly raw: string };

/** Evento com carimbo de recebimento, para a lista do historico. */
export type FeederEventEntry = {
  readonly id: string;
  readonly receivedAt: Date;
  readonly event: FeederEvent;
};

/** Estado da conexao com o broker. */
export type ConnectionStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connected' }
  | { readonly kind: 'reconnecting'; readonly attempt: number }
  | { readonly kind: 'error'; readonly message: string };

/** Credenciais do broker, guardadas no expo-secure-store. */
export type Credentials = {
  readonly host: string;
  readonly username: string;
  readonly password: string;
};
