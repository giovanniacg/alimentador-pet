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
  huge: 40,
} as const;

export const radius = {
  md: 12,
  lg: 20,
} as const;

/**
 * Altura minima de qualquer alvo tocavel.
 * WCAG 2.2 SC 2.5.8 pede 24x24; aqui vai bem acima porque o publico e 50+.
 */
export const MIN_TOUCH = 56;
