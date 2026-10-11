import Decimal from 'decimal.js'

/** Índices de bolsa e de fundos imobiliários acompanhados. */
export const MarketIndexCode = {
  IBOVESPA: 'IBOVESPA',
  IFIX: 'IFIX',
} as const

export type MarketIndexCode =
  (typeof MarketIndexCode)[keyof typeof MarketIndexCode]

export interface IndexClose {
  /** Dia do pregão (meia-noite UTC). */
  date: Date
  close: Decimal
}

/**
 * Série diária de fechamento do índice, do mais antigo ao mais novo, como a
 * fonte entregou. A fonte pode entregar pouco (o IFIX no Yahoo vem com um
 * único dia): quem decide se serve é o `IndexTrend`.
 */
export interface IndexHistory {
  code: MarketIndexCode
  /** Fonte e símbolo, ex.: "Yahoo Finance (^BVSP)". */
  source: string
  closes: IndexClose[]
}
