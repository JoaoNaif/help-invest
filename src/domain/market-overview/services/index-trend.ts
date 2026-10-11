import Decimal from 'decimal.js'
import { addUtcMonths, daysBetween } from '@/domain/shared/dates'
import { IndexClose, IndexHistory } from '../applications/dtos/market-index'

/** Regra do produto (não é norma): janela da média móvel. */
export const INDEX_MOVING_AVERAGE_DAYS = 200

/** Regra do produto (não é norma): janela do retorno, em meses. */
export const INDEX_RETURN_MONTHS = 12

/** Cotação mais velha que isso = fonte parada; o índice fica indisponível. */
export const INDEX_MAX_AGE_DAYS = 7

/** Quão antes da data-alvo de 12 meses a cotação de referência ainda vale (dias). */
export const INDEX_RETURN_MAX_GAP_DAYS = 10

export const IndexTrendDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
  MIXED: 'MIXED',
} as const

export type IndexTrendDirection =
  (typeof IndexTrendDirection)[keyof typeof IndexTrendDirection]

export interface IndexTrendReading {
  asOf: Date
  source: string
  /** % em 12 meses. */
  return12m: Decimal
  /** % do preço acima (+) ou abaixo (−) da média de 200 dias. */
  vsMovingAverage200: Decimal
  trend: IndexTrendDirection
}

export type IndexTrendResult =
  | { available: true; reading: IndexTrendReading }
  | {
      available: false
      reason: 'INSUFFICIENT_HISTORY' | 'STALE_QUOTE'
      detail: string
    }

/**
 * Tendência de um índice — pura, **descritiva e não preditiva**:
 * - `UP`: preço acima da média de 200 dias **e** retorno em 12 meses > 0;
 * - `DOWN`: preço abaixo da média **e** retorno < 0;
 * - `MIXED`: qualquer outro caso.
 * Sem histórico suficiente ou com cotação velha o índice é indisponível
 * (nunca uma tendência parcial).
 */
export class IndexTrend {
  static compute(history: IndexHistory, now: Date): IndexTrendResult {
    const closes = [...history.closes].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )

    if (closes.length < INDEX_MOVING_AVERAGE_DAYS) {
      return {
        available: false,
        reason: 'INSUFFICIENT_HISTORY',
        detail:
          `a fonte entregou ${closes.length} dia(s) de cotação e a média de ` +
          `${INDEX_MOVING_AVERAGE_DAYS} dias exige ${INDEX_MOVING_AVERAGE_DAYS}`,
      }
    }

    const last = closes[closes.length - 1]

    const reference = referenceClose(closes, last)

    if (!reference) {
      return {
        available: false,
        reason: 'INSUFFICIENT_HISTORY',
        detail: `sem cotação de cerca de ${INDEX_RETURN_MONTHS} meses atrás para o retorno`,
      }
    }

    if (daysBetween(last.date, now) > INDEX_MAX_AGE_DAYS) {
      return {
        available: false,
        reason: 'STALE_QUOTE',
        detail: `a última cotação tem mais de ${INDEX_MAX_AGE_DAYS} dias`,
      }
    }

    const window = closes.slice(-INDEX_MOVING_AVERAGE_DAYS)
    const average = window
      .reduce((sum, item) => sum.plus(item.close), new Decimal(0))
      .div(window.length)

    const vsMovingAverage200 = last.close.div(average).minus(1).times(100)
    const return12m = last.close.div(reference.close).minus(1).times(100)

    let trend: IndexTrendDirection = IndexTrendDirection.MIXED

    if (vsMovingAverage200.greaterThan(0) && return12m.greaterThan(0)) {
      trend = IndexTrendDirection.UP
    } else if (vsMovingAverage200.lessThan(0) && return12m.lessThan(0)) {
      trend = IndexTrendDirection.DOWN
    }

    return {
      available: true,
      reading: {
        asOf: last.date,
        source: history.source,
        return12m,
        vsMovingAverage200,
        trend,
      },
    }
  }
}

/** Último fechamento até ~12 meses antes da última cotação, se for próximo da data-alvo. */
function referenceClose(closes: IndexClose[], last: IndexClose) {
  const target = addUtcMonths(last.date, -INDEX_RETURN_MONTHS)

  let reference: IndexClose | null = null

  for (const item of closes) {
    if (item.date.getTime() > target.getTime()) break

    reference = item
  }

  if (!reference) return null

  return daysBetween(reference.date, target) <= INDEX_RETURN_MAX_GAP_DAYS
    ? reference
    : null
}
