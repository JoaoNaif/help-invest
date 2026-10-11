/** O que o usuário quer da carteira. Vale só para a análise em que foi escolhida. */
export const PortfolioStrategy = {
  /** Equilibrar. */
  BALANCE: 'BALANCE',
  /** Rentabilizar ao máximo (dentro do que o perfil comporta). */
  MAX_RETURN: 'MAX_RETURN',
  /** Gerar renda recorrente. */
  INCOME: 'INCOME',
  /** Proteger o patrimônio. */
  PROTECT: 'PROTECT',
} as const

export type PortfolioStrategy =
  (typeof PortfolioStrategy)[keyof typeof PortfolioStrategy]
