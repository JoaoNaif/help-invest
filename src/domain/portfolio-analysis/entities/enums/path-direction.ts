/** Situação da carteira frente à faixa-alvo da classe. */
export const PathDirection = {
  /** Abaixo do mínimo da faixa. */
  INCREASE: 'INCREASE',
  /** Dentro da faixa. */
  MAINTAIN: 'MAINTAIN',
  /** Acima do máximo da faixa. */
  REDUCE: 'REDUCE',
} as const

export type PathDirection = (typeof PathDirection)[keyof typeof PathDirection]
