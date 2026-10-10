import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  CeilingMethod,
  CeilingPriceCalculator,
} from './ceiling-price-calculator'

describe('Ceiling Price Calculator', () => {
  it('should compute the Bazin ceiling from the average dividend', () => {
    const [bazin] = CeilingPriceCalculator.calculate({
      price: new Decimal('20'),
      averageAnnualDividendPerShare: new Decimal('1.80'),
      earningsPerShare: null,
      bookValuePerShare: null,
    })

    // 1,80 / 6% = 30
    expect(bazin.method).toBe(CeilingMethod.BAZIN)
    expect(bazin.value.equals('30')).toBe(true)
    // 30 / 20 − 1 = +50%
    expect(bazin.upsidePercent.equals('50')).toBe(true)
  })

  it("should compute Graham's number from EPS and book value", () => {
    const [graham] = CeilingPriceCalculator.calculate({
      price: new Decimal('40'),
      averageAnnualDividendPerShare: null,
      earningsPerShare: new Decimal('4'),
      bookValuePerShare: new Decimal('25'),
    })

    // √(22,5 × 4 × 25) = √2250 ≈ 47,43
    expect(graham.method).toBe(CeilingMethod.GRAHAM)
    expect(graham.value.toFixed(2)).toBe('47.43')
    expect(graham.upsidePercent.greaterThan(0)).toBe(true)
  })

  it('should report negative upside when the price is above the ceiling', () => {
    const [bazin] = CeilingPriceCalculator.calculate({
      price: new Decimal('60'),
      averageAnnualDividendPerShare: new Decimal('1.80'),
      earningsPerShare: null,
      bookValuePerShare: null,
    })

    expect(bazin.upsidePercent.equals('-50')).toBe(true)
  })

  it('should skip methods without enough data', () => {
    const results = CeilingPriceCalculator.calculate({
      price: new Decimal('20'),
      averageAnnualDividendPerShare: new Decimal(0),
      earningsPerShare: new Decimal('-1.5'),
      bookValuePerShare: new Decimal('10'),
    })

    expect(results).toEqual([])
  })

  it('should return both methods when data is available', () => {
    const results = CeilingPriceCalculator.calculate({
      price: new Decimal('20'),
      averageAnnualDividendPerShare: new Decimal('1.5'),
      earningsPerShare: new Decimal('3'),
      bookValuePerShare: new Decimal('18'),
    })

    expect(results.map((result) => result.method)).toEqual([
      CeilingMethod.BAZIN,
      CeilingMethod.GRAHAM,
    ])
  })
})
