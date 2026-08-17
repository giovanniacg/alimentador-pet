/**
 * Modo de dosagem do aparelho (docs/mqtt.md, v2).
 *
 * A v1 roda sem celula de carga (`timer`); os modos com balanca sao opcionais
 * e ligados remotamente, porque ninguem estara fisicamente na casa.
 */
export type FeedMode = 'timer' | 'scale_bowl' | 'scale_hopper';

/**
 * Quanto servir. Uniao discriminada por `unit`: no modo timer a dose e tempo
 * de rosca girando, nos modos com balanca e peso. Assim nao existe estado
 * ilegal do tipo "gramas e segundos ao mesmo tempo" nem numero solto sem
 * unidade (TypeScript Handbook: Narrowing, discriminated unions).
 */
export type Dose =
  | { readonly unit: 'secs'; readonly secs: number }
  | { readonly unit: 'grams'; readonly grams: number };

/** Uma refeicao agendada: hora, minuto e dose. */
export type Meal = {
  readonly h: number;
  readonly m: number;
  readonly dose: Dose;
};

/** Ultima refeicao entregue, como vem no topico state. */
export type LastMeal = {
  readonly ts: string | null;
  readonly dose: Dose | null;
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
  /** Modo que o firmware diz estar rodando agora. */
  readonly mode: FeedMode | null;
  /** Leitura da balanca; null fora dos modos com balanca (contrato v2). */
  readonly scaleGrams: number | null;
  readonly lastMeal: LastMeal | null;
  readonly nextMeal: Meal | null;
  readonly skipNext: boolean;
  /** Versao do firmware, quando ele informar. Ainda nao esta no contrato. */
  readonly version: string | null;
};

/**
 * Config vigente (topico retained `config`, espelho da NVS).
 *
 * Aqui os campos sao todos obrigatorios: o parser preenche o que faltar com o
 * default do contrato, para a tela de ajustes nunca ter que lidar com buraco.
 */
export type FeederConfig = {
  readonly mode: FeedMode;
  /** Velocidade de cruzeiro da rosca, 5 a 60 rpm. */
  readonly rpm: number;
  /** Dose rapida no modo timer, em segundos. */
  readonly defaultSecs: number;
  /** Dose rapida nos modos com balanca, em gramas. */
  readonly defaultGrams: number;
  /** Teto de seguranca de rosca girando por dose, em segundos. */
  readonly maxSecs: number;
  readonly siren: boolean;
  readonly sirenSecs: number;
  /** Estimativa de gramas por segundo, usada para converter entre modos. */
  readonly gramsPerSecond: number;
};

/** Mudanca parcial de config: o `cmd/config` so leva o que mudou. */
export type ConfigPatch = Partial<FeederConfig>;

/** Evento pontual (topico `event`, sem retained). */
export type FeederEvent =
  | { readonly kind: 'meal_done'; readonly dose: Dose | null }
  | { readonly kind: 'meal_failed'; readonly reason: string | null }
  | { readonly kind: 'button_feed' }
  | { readonly kind: 'config_changed' }
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
