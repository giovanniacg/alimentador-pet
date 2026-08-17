/**
 * Tema unico e claro. Sem modo escuro por ora (decisao do projeto).
 *
 * Contraste conferido contra o branco #FFFFFF: texto >= 4.5:1 e elementos de
 * interface >= 3:1, conforme WCAG 2.2 SC 1.4.3 e 1.4.11.
 *   text     #111111 -> 18.9:1
 *   muted    #4A4A4A -> 8.9:1
 *   green    #1B7F3B -> 5.1:1
 *   red      #B3261E -> 6.5:1
 *   amber    #8A5A00 -> 5.6:1
 *   blue     #0B5FA5 -> 6.9:1
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F2F4F7',
  border: '#8A8F98',
  text: '#111111',
  muted: '#4A4A4A',
  green: '#1B7F3B',
  greenSurface: '#E4F3E9',
  red: '#B3261E',
  redSurface: '#FBE9E7',
  amber: '#8A5A00',
  amberSurface: '#FDF1DC',
  blue: '#0B5FA5',
  blueSurface: '#E4EEF7',
  disabled: '#6B7280',
  disabledSurface: '#E3E5E8',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSizes = {
  /** Legenda. Nunca abaixo disso. */
  small: 16,
  body: 20,
  large: 24,
  title: 30,
  /** Glifo de status. Um uso por tela, nunca rotulo de controle. */
  display: 40,
  /** @deprecated Use `fontSizes.display`, e so em glifo de status. */
  huge: 40,
} as const;

export const radius = {
  md: 12,
  lg: 20,
} as const;

/**
 * Alturas de controle, em dp FIXO. Nunca multiplicar por fontScale: o texto
 * dentro cresce e o controle cresce junto via `minHeight`.
 *
 * A regra que atravessa o app: fonte escala com o sistema, caixa nao escala,
 * cresce. Altura de controle e sempre `minHeight`, nunca `height`.
 */
export const control = {
  /** Chip de dia, controle em fileira. */
  sm: 44,
  /** Alvo confortavel padrao. */
  md: 48,
  /** Botao padrao, input, linha tocavel. */
  lg: 56,
  /** Botao primario de destaque. TETO: nao existe controle maior. */
  xl: 64,
} as const;

export const iconSize = { sm: 20, md: 24, lg: 28 } as const;

/**
 * Teto do multiplicador de fonte, por papel do texto.
 *
 * Texto de CONTEUDO (paragrafo, descricao, erro, item de lista) nao entra
 * aqui: escala livre ate o maximo do sistema, como pede WCAG 2.2 SC 1.4.4.
 * Capar so vale dentro de controle, onde a caixa tem geometria propria, e o
 * baseline do app ja parte de 20 dp de corpo.
 */
export const fontCap = {
  /** Texto DENTRO de botao, chip, aba. */
  control: 1.3,
  /** Numero grande do stepper, simbolo de status. */
  display: 1.2,
  /** Titulo de tela. */
  title: 1.6,
  /** Rotulo de aba: o alvo e a celula inteira, o texto nao pode truncar. */
  tab: 1.2,
} as const;

/**
 * @deprecated Use `control.lg`. Mantido como alias para nao quebrar
 * consumidores; sai na versao seguinte.
 */
export const MIN_TOUCH = control.lg;

/**
 * @deprecated Nao existe mais largura minima de chip: os sete dias dividem uma
 * linha so (`flexBasis: 0`) e quem garante o alvo e a ALTURA (`control.lg`).
 * Use `control.sm` quando precisar de um controle baixo em fileira.
 */
export const MIN_CHIP_TOUCH = control.sm;
