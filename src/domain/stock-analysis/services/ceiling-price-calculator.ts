import Decimal from 'decimal.js'

/**
 * Método Bazin (Décio Bazin): preço teto = dividendo médio anual / yield
 * mínimo exigido. 6% a.a. é a convenção do método — não é norma.
 */
export const BAZIN_REQUIRED_YIELD_PERCENT = new Decimal(6)

/**
 * Número de Graham: √(22,5 × LPA × VPA). 22,5 = 15 (P/L máx.) × 1,5 (P/VP
 * máx.), de "O Investidor Inteligente" (Benjamin Graham).
 */
export const GRAHAM_MULTIPLIER = new Decimal('22.5')

export const CeilingMethod = {
  BAZIN: 'BAZIN',
  GRAHAM: 'GRAHAM',
} as const
export type CeilingMethod = (typeof CeilingMethod)[keyof typeof CeilingMethod]

export interface CeilingPrice {
  method: CeilingMethod
  /** Preço teto por ação, em R$. */
  value: Decimal
  /** (teto / preço − 1) em %. Positivo = preço abaixo do teto. */
  upsidePercent: Decimal
}

export interface CeilingPriceInput {
  price: Decimal
  averageAnnualDividendPerShare: Decimal | null
  earningsPerShare: Decimal | null
  bookValuePerShare: Decimal | null
}

/**
 * Preço teto por método. Um método sem dado suficiente (ou com lucro/patrimônio
 * negativo) simplesmente não aparece — nunca vira zero.
 */
export class CeilingPriceCalculator {
  static calculate(input: CeilingPriceInput): CeilingPrice[] {
    const results: CeilingPrice[] = []

    const bazin = bazinCeiling(input.averageAnnualDividendPerShare)
    if (bazin) results.push(withUpside(CeilingMethod.BAZIN, bazin, input.price))

    const graham = grahamCeiling(
      input.earningsPerShare,
      input.bookValuePerShare
    )
    if (graham) {
      results.push(withUpside(CeilingMethod.GRAHAM, graham, input.price))
    }

    return results
  }
}

function bazinCeiling(averageAnnualDividend: Decimal | null) {
  if (!averageAnnualDividend || !averageAnnualDividend.greaterThan(0)) {
    return null
  }

  return averageAnnualDividend.div(BAZIN_REQUIRED_YIELD_PERCENT).times(100)
}

function grahamCeiling(eps: Decimal | null, bvps: Decimal | null) {
  if (!eps || !bvps || !eps.greaterThan(0) || !bvps.greaterThan(0)) {
    return null
  }

  return GRAHAM_MULTIPLIER.times(eps).times(bvps).sqrt()
}

function withUpside(
  method: CeilingMethod,
  value: Decimal,
  price: Decimal
): CeilingPrice {
  return {
    method,
    value,
    upsidePercent: price.greaterThan(0)
      ? value.div(price).minus(1).times(100)
      : new Decimal(0),
  }
}
