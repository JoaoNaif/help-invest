import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { Indexer } from '@/domain/shared/enums/indexer'
import { MarketReference, RateNormalizer } from './rate-normalizer'

const market: MarketReference = {
  cdi: new Decimal('14.90'),
  selic: new Decimal('15.00'),
  ipca12m: new Decimal('5.00'),
}

describe('Rate Normalizer', () => {
  it('should keep a fixed rate as is', () => {
    const rate = RateNormalizer.grossAnnualRate(
      Indexer.PRE,
      new Decimal('14.2'),
      market
    )

    expect(rate.equals('14.2')).toBe(true)
  })

  it('should convert % of CDI into an annual rate', () => {
    // 110% × 14,90% = 16,39%
    const rate = RateNormalizer.grossAnnualRate(
      Indexer.CDI,
      new Decimal('110'),
      market
    )

    expect(rate.equals('16.39')).toBe(true)
  })

  it('should convert % of Selic into an annual rate', () => {
    const rate = RateNormalizer.grossAnnualRate(
      Indexer.SELIC,
      new Decimal('100'),
      market
    )

    expect(rate.equals('15')).toBe(true)
  })

  it('should compound IPCA + spread instead of adding them', () => {
    // (1,05 × 1,065) − 1 = 11,825% (não 11,5%)
    const rate = RateNormalizer.grossAnnualRate(
      Indexer.IPCA,
      new Decimal('6.5'),
      market
    )

    expect(rate.equals('11.825')).toBe(true)
  })

  it('should require IPCA 12m to normalize IPCA+ rates', () => {
    expect(() =>
      RateNormalizer.grossAnnualRate(Indexer.IPCA, new Decimal('6.5'), {
        ...market,
        ipca12m: null,
      })
    ).toThrow()
  })

  it('should accumulate monthly rates by compounding', () => {
    // 1,005^12 − 1 = 6,1678%
    const accumulated = RateNormalizer.accumulate(
      Array.from({ length: 12 }, () => new Decimal('0.5'))
    )

    expect(accumulated.toFixed(4)).toBe('6.1678')
  })
})
