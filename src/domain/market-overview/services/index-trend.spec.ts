import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  FakeMarketIndexProvider,
  makeIndexCloses,
} from 'test/gateways/fake-market-index-provider'
import {
  IndexHistory,
  MarketIndexCode,
} from '../applications/dtos/market-index'
import { IndexTrend, IndexTrendDirection } from './index-trend'

const LAST = new Date('2026-10-08T00:00:00Z')
const NOW = new Date('2026-10-10T12:00:00Z')

function history(
  closes: IndexHistory['closes'],
  code: MarketIndexCode = MarketIndexCode.IBOVESPA
): IndexHistory {
  return { code, source: 'Yahoo Finance (^BVSP)', closes }
}

describe('Index Trend', () => {
  it('should compute the 12 month return and the distance to the 200 day average', () => {
    // 499 fechamentos em 100 e o último em 110.
    const closes = makeIndexCloses(LAST, 500, 100, 100)
    closes[closes.length - 1] = {
      ...closes[closes.length - 1],
      close: new Decimal(110),
    }

    const result = IndexTrend.compute(history(closes), NOW)

    expect(result.available).toBe(true)

    if (result.available) {
      // média = (199 × 100 + 110) / 200 = 100,05 → 110 / 100,05 − 1
      expect(result.reading.vsMovingAverage200.toFixed(2)).toBe('9.95')
      // 110 / 100 − 1
      expect(result.reading.return12m.toFixed(2)).toBe('10.00')
      expect(result.reading.trend).toBe(IndexTrendDirection.UP)
      expect(result.reading.asOf).toEqual(LAST)
      expect(result.reading.source).toBe('Yahoo Finance (^BVSP)')
    }
  })

  it('should be UP above the average with a positive return', () => {
    const result = IndexTrend.compute(
      history(makeIndexCloses(LAST, 500, 100, 200)),
      NOW
    )

    expect(result.available && result.reading.trend).toBe(
      IndexTrendDirection.UP
    )
  })

  it('should be DOWN below the average with a negative return', () => {
    const result = IndexTrend.compute(
      history(makeIndexCloses(LAST, 500, 200, 100)),
      NOW
    )

    expect(result.available && result.reading.trend).toBe(
      IndexTrendDirection.DOWN
    )
  })

  it('should be MIXED when price and return disagree', () => {
    // Subiu em 12 meses (retorno > 0), mas as últimas semanas caíram abaixo
    // da média de 200 dias.
    const closes = makeIndexCloses(LAST, 500, 100, 200)

    for (let index = closes.length - 20; index < closes.length; index++) {
      closes[index] = { ...closes[index], close: new Decimal(160) }
    }

    const result = IndexTrend.compute(history(closes), NOW)

    expect(result.available && result.reading.trend).toBe(
      IndexTrendDirection.MIXED
    )
    expect(result.available && result.reading.return12m.greaterThan(0)).toBe(
      true
    )
    expect(
      result.available && result.reading.vsMovingAverage200.lessThan(0)
    ).toBe(true)
  })

  it('should be MIXED on a flat series (nothing to describe)', () => {
    const result = IndexTrend.compute(
      history(makeIndexCloses(LAST, 500, 100, 100)),
      NOW
    )

    expect(result.available && result.reading.trend).toBe(
      IndexTrendDirection.MIXED
    )
  })

  it('should sort an unordered series before computing', () => {
    const closes = makeIndexCloses(LAST, 500, 100, 200).reverse()

    const result = IndexTrend.compute(history(closes), NOW)

    expect(result.available && result.reading.asOf).toEqual(LAST)
    expect(result.available && result.reading.trend).toBe(
      IndexTrendDirection.UP
    )
  })

  describe('unavailable', () => {
    it('should be unavailable with the single close the source gives for IFIX', () => {
      const result = IndexTrend.compute(
        history(makeIndexCloses(LAST, 1, 3988.54, 3988.54), 'IFIX'),
        NOW
      )

      expect(result).toMatchObject({
        available: false,
        reason: 'INSUFFICIENT_HISTORY',
      })
      expect(!result.available && result.detail).toContain('1 dia(s)')
    })

    it('should be unavailable with fewer than 200 closes', () => {
      const result = IndexTrend.compute(
        history(makeIndexCloses(LAST, 199, 100, 120)),
        NOW
      )

      expect(result).toMatchObject({
        available: false,
        reason: 'INSUFFICIENT_HISTORY',
      })
    })

    it('should be unavailable without a close from about 12 months ago', () => {
      // 300 dias: tem média de 200, mas não tem a cotação de 12 meses atrás.
      const result = IndexTrend.compute(
        history(makeIndexCloses(LAST, 300, 100, 120)),
        NOW
      )

      expect(result).toMatchObject({
        available: false,
        reason: 'INSUFFICIENT_HISTORY',
      })
      expect(!result.available && result.detail).toContain('12 meses')
    })

    it('should be unavailable when the reference is too far from the target date', () => {
      // Série com buraco: 250 dias recentes e um fechamento de 2 anos atrás.
      const closes = [
        ...makeIndexCloses(new Date('2024-10-01T00:00:00Z'), 1, 100, 100),
        ...makeIndexCloses(LAST, 250, 100, 120),
      ]

      const result = IndexTrend.compute(history(closes), NOW)

      expect(result.available).toBe(false)
    })

    it('should be unavailable when the last quote is stale', () => {
      const result = IndexTrend.compute(
        history(
          makeIndexCloses(new Date('2026-09-20T00:00:00Z'), 500, 100, 120)
        ),
        NOW
      )

      expect(result).toMatchObject({
        available: false,
        reason: 'STALE_QUOTE',
      })
    })

    it('should accept a quote within the tolerance', () => {
      const result = IndexTrend.compute(
        history(
          makeIndexCloses(new Date('2026-10-03T00:00:00Z'), 500, 100, 120)
        ),
        NOW
      )

      // 7 dias: no limite, ainda vale
      expect(result.available).toBe(true)
    })
  })

  it('should never invent a substitute: the provider fake knows only what it was given', async () => {
    const provider = new FakeMarketIndexProvider()
    const result = await provider.getHistory(MarketIndexCode.IFIX)

    expect(result.isLeft()).toBe(true)
  })
})
