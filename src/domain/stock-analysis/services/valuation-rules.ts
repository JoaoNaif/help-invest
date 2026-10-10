import Decimal from 'decimal.js'

/**
 * Regra do produto (não é norma): múltiplo até este % acima/abaixo da mediana
 * dos concorrentes ainda conta como "na média".
 */
export const VALUATION_FAIR_BAND_PERCENT = new Decimal(15)

export const ValuationVerdict = {
  CHEAP: 'CHEAP',
  FAIR: 'FAIR',
  EXPENSIVE: 'EXPENSIVE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const
export type ValuationVerdict =
  (typeof ValuationVerdict)[keyof typeof ValuationVerdict]

export interface MultipleValuation {
  value: Decimal | null
  peerMedian: Decimal | null
  /** (valor / mediana − 1) em %. `null` quando o veredito é UNAVAILABLE. */
  diffPercent: Decimal | null
  verdict: ValuationVerdict
}

/**
 * Compara um múltiplo (P/L, P/VP) com a mediana dos concorrentes — puro.
 * Múltiplo nulo ou ≤ 0 (prejuízo, patrimônio negativo) não é comparável.
 */
export class ValuationRules {
  static compare(
    value: Decimal | null,
    peers: (Decimal | null)[]
  ): MultipleValuation {
    const comparablePeers = peers.filter(isPositive)
    const peerMedian = median(comparablePeers)

    if (!isPositive(value) || !peerMedian) {
      return {
        value,
        peerMedian,
        diffPercent: null,
        verdict: ValuationVerdict.UNAVAILABLE,
      }
    }

    const diffPercent = value.div(peerMedian).minus(1).times(100)

    return {
      value,
      peerMedian,
      diffPercent,
      verdict: verdictFor(diffPercent),
    }
  }
}

function verdictFor(diffPercent: Decimal): ValuationVerdict {
  if (diffPercent.greaterThan(VALUATION_FAIR_BAND_PERCENT)) {
    return ValuationVerdict.EXPENSIVE
  }

  if (diffPercent.lessThan(VALUATION_FAIR_BAND_PERCENT.negated())) {
    return ValuationVerdict.CHEAP
  }

  return ValuationVerdict.FAIR
}

function isPositive(value: Decimal | null): value is Decimal {
  return value !== null && value.greaterThan(0)
}

function median(values: Decimal[]) {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a.comparedTo(b))
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1
    ? sorted[middle]
    : sorted[middle - 1].plus(sorted[middle]).div(2)
}
