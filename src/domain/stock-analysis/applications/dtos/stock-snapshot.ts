import Decimal from 'decimal.js'

export const DividendKind = {
  DIVIDEND: 'DIVIDEND',
  JCP: 'JCP',
  OTHER: 'OTHER',
} as const
export type DividendKind = (typeof DividendKind)[keyof typeof DividendKind]

export interface DividendPayment {
  /**
   * Data ex: a partir dela a ação negocia sem direito ao provento. A data com
   * (último dia com direito) é o dia útil anterior. A fonte (Yahoo) só traz a ex.
   */
  exDate: Date
  /** `null` = ainda não anunciada. */
  paymentDate: Date | null
  /** Valor bruto por ação, em R$. */
  amountPerShare: Decimal
  kind: DividendKind
}

/** Todo campo pode faltar na fonte; `null` = indisponível, nunca zero. */
export interface StockFundamentals {
  /** Preço / Lucro. Negativo ou nulo quando a empresa tem prejuízo. */
  priceToEarnings: Decimal | null
  priceToBook: Decimal | null
  /** Lucro por ação (LPA), em R$. */
  earningsPerShare: Decimal | null
  /** Valor patrimonial por ação (VPA), em R$. */
  bookValuePerShare: Decimal | null
  /** % */
  returnOnEquity: Decimal | null
}

/** Tendência do que os analistas dizem — agregado, não a opinião de um deles. */
export interface AnalystConsensus {
  analystCount: number
  buy: number
  hold: number
  sell: number
  /** Preço-alvo médio, em R$. */
  targetPrice: Decimal | null
}

export interface StockSnapshot {
  ticker: string
  name: string
  sector: string | null
  /** Último preço, em R$. */
  price: Decimal
  priceDate: Date
  fundamentals: StockFundamentals
  dividends: DividendPayment[]
  /** Primeira data coberta pelo histórico de proventos da fonte. */
  dividendsHistoryFrom: Date
  /** `null` = a fonte não cobre este ativo. */
  consensus: AnalystConsensus | null
  /** Ex.: "brapi.dev" — gravado junto com a análise. */
  source: string
}
