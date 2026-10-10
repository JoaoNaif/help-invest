import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { makeStockSnapshot } from 'test/factories/make-stock-snapshot'
import { StockSnapshot } from '../applications/dtos/stock-snapshot'
import { CeilingPriceCalculator } from './ceiling-price-calculator'
import { DividendAnalyzer } from './dividend-analyzer'
import { StockRules } from './stock-rules'

const now = new Date('2026-10-10T12:00:00Z')

function codes(snapshotOverride: Partial<StockSnapshot> = {}, hasPeers = true) {
  const snapshot = makeStockSnapshot(snapshotOverride)
  const dividends = DividendAnalyzer.analyze({
    dividends: snapshot.dividends,
    price: snapshot.price,
    now,
    historyFrom: snapshot.dividendsHistoryFrom,
  })
  const ceilings = CeilingPriceCalculator.calculate({
    price: snapshot.price,
    averageAnnualDividendPerShare: dividends.averageAnnualPerShare,
    earningsPerShare: snapshot.fundamentals.earningsPerShare,
    bookValuePerShare: snapshot.fundamentals.bookValuePerShare,
  })

  return StockRules.alertsFor({
    snapshot,
    dividends,
    ceilings,
    hasPeers,
    now,
  }).map((alert) => alert.code)
}

describe('Stock Rules', () => {
  it('should not alert on a healthy stock', () => {
    expect(codes()).toEqual([])
  })

  it('should warn when the price is stale', () => {
    expect(codes({ priceDate: new Date('2026-09-25T21:00:00Z') })).toContain(
      'STALE_PRICE'
    )
  })

  it('should tell when there are no peers to compare', () => {
    expect(codes({}, false)).toContain('NO_PEERS')
  })

  it('should warn about losses', () => {
    expect(
      codes({
        fundamentals: {
          ...makeStockSnapshot().fundamentals,
          earningsPerShare: new Decimal('-1'),
        },
      })
    ).toContain('NEGATIVE_EARNINGS')
  })

  it('should note when dividends had no payment history', () => {
    expect(codes({ dividends: [] })).toContain('NO_DIVIDENDS')
  })

  it('should note when the source has no dividend history at all', () => {
    expect(codes({ dividends: [], dividendsHistoryFrom: now })).toContain(
      'DIVIDEND_HISTORY_MISSING'
    )
  })

  it('should warn when dividends are not paid every year', () => {
    const snapshot = makeStockSnapshot()

    expect(codes({ dividends: snapshot.dividends.slice(2) })).toContain(
      'DIVIDENDS_INCONSISTENT'
    )
  })

  it('should note when the last 12 months paid far below the average', () => {
    const snapshot = makeStockSnapshot()
    const dividends = snapshot.dividends.map((dividend) =>
      dividend.exDate.getUTCFullYear() === 2026
        ? { ...dividend, amountPerShare: new Decimal('0.5') }
        : dividend
    )

    // média (2+2+2+2+0,5)/5 = 1,70; 12 meses = 0,50 → 29% da média
    expect(codes({ dividends })).toContain('DIVIDENDS_BELOW_AVERAGE')
  })

  it('should warn when the price is above every ceiling', () => {
    // Bazin 33,33 e Graham 37,5: preço 60 está acima dos dois
    expect(codes({ price: new Decimal('60') })).toContain('ABOVE_CEILING')
    expect(codes({ price: new Decimal('20') })).not.toContain('ABOVE_CEILING')
  })

  it('should tell when no analyst covers the stock', () => {
    expect(codes({ consensus: null })).toContain('NO_ANALYST_COVERAGE')
  })

  it('should tell when few analysts cover the stock', () => {
    expect(
      codes({
        consensus: {
          analystCount: 2,
          buy: 2,
          hold: 0,
          sell: 0,
          targetPrice: null,
        },
      })
    ).toContain('LOW_ANALYST_COVERAGE')
  })
})
