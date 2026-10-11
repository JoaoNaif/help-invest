/**
 * Como o cenário de hoje trata o tópico. Descreve o cenário; não é ordem de
 * compra ou venda.
 */
export const Stance = {
  FAVORED: 'FAVORED',
  NEUTRAL: 'NEUTRAL',
  LESS_FAVORED: 'LESS_FAVORED',
  /** Faltou dado para a regra: nunca vira neutro "de mentira". */
  UNAVAILABLE: 'UNAVAILABLE',
} as const

export type Stance = (typeof Stance)[keyof typeof Stance]
