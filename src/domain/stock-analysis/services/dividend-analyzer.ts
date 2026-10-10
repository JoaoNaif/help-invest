import Decimal from 'decimal.js'
import { DividendPayment } from '../applications/dtos/stock-snapshot'

/** Quantas janelas de 12 meses entram na média (a mesma que o método Bazin usa). */
export const DIVIDEND_HISTORY_YEARS = 5

export interface DividendAnalysisInput {
  dividends: DividendPayment[]
  price: Decimal
  now: Date
  /** Primeira data coberta pela fonte; janelas anteriores a ela não contam. */
  historyFrom: Date
}

export interface DividendAnalysis {
  /** Soma por ação das datas ex dos últimos 12 meses, em R$. */
  trailing12mPerShare: Decimal
  /** trailing12mPerShare / preço, em %. */
  trailing12mYield: Decimal
  /** Média por ação das janelas de 12 meses cobertas; `null` sem histórico. */
  averageAnnualPerShare: Decimal | null
  /** Janelas de 12 meses cobertas pelo histórico (0 a DIVIDEND_HISTORY_YEARS). */
  yearsCovered: number
  /** Dessas, em quantas houve pagamento. */
  yearsWithPayment: number
  /** Pagou em todas as janelas cobertas (e há ao menos uma). */
  consistent: boolean
  /** Próximo provento com data ex ainda por vir, se já anunciado. */
  upcoming: DividendPayment | null
}

/**
 * Análise de proventos — puro, sem banco nem LLM. Valores brutos: o IR do JCP
 * não é descontado.
 */
export class DividendAnalyzer {
  static analyze(input: DividendAnalysisInput): DividendAnalysis {
    const { dividends, price, now, historyFrom } = input

    const windows = Array.from({ length: DIVIDEND_HISTORY_YEARS }, (_, i) => ({
      start: shiftYears(now, -(i + 1)),
      end: shiftYears(now, -i),
    })).filter((window) => window.start.getTime() >= historyFrom.getTime())

    const totals = windows.map((window) =>
      dividends
        .filter(
          (dividend) =>
            dividend.exDate.getTime() > window.start.getTime() &&
            dividend.exDate.getTime() <= window.end.getTime()
        )
        .reduce(
          (sum, dividend) => sum.plus(dividend.amountPerShare),
          new Decimal(0)
        )
    )

    const trailing12mPerShare = dividends
      .filter(
        (dividend) =>
          dividend.exDate.getTime() > shiftYears(now, -1).getTime() &&
          dividend.exDate.getTime() <= now.getTime()
      )
      .reduce(
        (sum, dividend) => sum.plus(dividend.amountPerShare),
        new Decimal(0)
      )

    const yearsWithPayment = totals.filter((total) =>
      total.greaterThan(0)
    ).length

    const upcoming =
      dividends
        .filter((dividend) => dividend.exDate.getTime() > now.getTime())
        .sort((a, b) => a.exDate.getTime() - b.exDate.getTime())[0] ?? null

    return {
      trailing12mPerShare,
      trailing12mYield: price.greaterThan(0)
        ? trailing12mPerShare.div(price).times(100)
        : new Decimal(0),
      averageAnnualPerShare: windows.length
        ? totals
            .reduce((sum, total) => sum.plus(total), new Decimal(0))
            .div(windows.length)
        : null,
      yearsCovered: windows.length,
      yearsWithPayment,
      consistent: windows.length > 0 && yearsWithPayment === windows.length,
      upcoming,
    }
  }
}

function shiftYears(date: Date, years: number) {
  const shifted = new Date(date)
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years)

  return shifted
}
