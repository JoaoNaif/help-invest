/** Assunto de uma leitura do cenário (não é um produto específico). */
export const ReadingTopic = {
  FIXED_POST: 'FIXED_POST',
  FIXED_PRE: 'FIXED_PRE',
  FIXED_INFLATION: 'FIXED_INFLATION',
  /** LCA/LCI: renda fixa isenta de IR para pessoa física. */
  TAX_EXEMPT: 'TAX_EXEMPT',
  STOCKS: 'STOCKS',
  REAL_ESTATE_FUNDS: 'REAL_ESTATE_FUNDS',
} as const

export type ReadingTopic = (typeof ReadingTopic)[keyof typeof ReadingTopic]
