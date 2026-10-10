import { Alert } from '@/domain/shared/alert'

/**
 * O que fica gravado em `StockAnalysis.result` e o front consome. Tudo
 * serializável: dinheiro, taxas e múltiplos em string (2 casas), datas em ISO.
 * `null` = a fonte não trouxe o dado (nunca zero).
 */
export type StockMultipleReport = {
  value: string | null
  peerMedian: string | null
  /** (valor / mediana − 1) em %. */
  diffPercent: string | null
  verdict: 'CHEAP' | 'FAIR' | 'EXPENSIVE' | 'UNAVAILABLE'
}

export type StockReportItem = {
  ticker: string
  name: string
  sector: string | null
  /** R$ */
  price: string
  priceDate: string
  /** Valor que o usuário pretende investir, se informado. */
  plannedAmount: string | null
  source: string
  fundamentals: {
    priceToEarnings: string | null
    priceToBook: string | null
    /** R$ por ação */
    earningsPerShare: string | null
    /** R$ por ação */
    bookValuePerShare: string | null
    /** % */
    returnOnEquity: string | null
  }
  dividends: {
    /** R$ por ação, últimos 12 meses (valores brutos). */
    trailing12mPerShare: string
    /** % */
    trailing12mYield: string
    averageAnnualPerShare: string | null
    yearsCovered: number
    yearsWithPayment: number
    consistent: boolean
    /** Provento com data ex ainda por vir, se já anunciado. */
    upcoming: { exDate: string; amountPerShare: string } | null
    /** Data ex, não data com (a com é o dia útil anterior). */
    dateKind: 'EX'
  }
  ceilingPrices: {
    method: 'BAZIN' | 'GRAHAM'
    /** R$ */
    value: string
    /** (teto / preço − 1) em %. */
    upsidePercent: string
  }[]
  valuation: {
    group: string | null
    priceToEarnings: StockMultipleReport
    priceToBook: StockMultipleReport
    peers: {
      ticker: string
      name: string
      priceToEarnings: string | null
      priceToBook: string | null
      dividendYield: string
    }[]
    /** Concorrentes que a fonte não respondeu. */
    peersUnavailable: string[]
  }
  /** Tendência dos analistas; `null` = sem cobertura. */
  consensus: {
    analystCount: number
    buy: number
    hold: number
    sell: number
    targetPrice: string | null
  } | null
  alerts: Alert[]
}

export type StockAnalysisReport = {
  items: StockReportItem[]
  /** Alertas da análise toda: perfil e combinação das ações. */
  alerts: Alert[]
}
