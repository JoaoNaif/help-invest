import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { SelicTrend } from '@/domain/portfolio-analysis/entities/enums/selic-trend'
import { ReadingTopic } from '../entities/enums/reading-topic'
import { IndexReading } from '../applications/dtos/market-overview'
import { IndexTrendDirection } from './index-trend'
import { IndexContext, MarketReadings } from './market-readings'

const up: IndexReading = {
  asOf: '2026-10-09',
  source: 'Yahoo Finance (^BVSP)',
  return12m: '12.40',
  vsMovingAverage200: '3.10',
  trend: IndexTrendDirection.UP,
}

function build(
  stocks: IndexContext | undefined,
  fii: IndexContext | undefined,
  realRate = '2.5',
  trend: SelicTrend | null = SelicTrend.STABLE
) {
  return MarketReadings.build({
    selic: new Decimal('14.75'),
    ipca12m: new Decimal('4.91'),
    realRate: new Decimal(realRate),
    trend,
    indices:
      stocks && fii
        ? {
            [ReadingTopic.STOCKS]: stocks,
            [ReadingTopic.REAL_ESTATE_FUNDS]: fii,
          }
        : undefined,
  })
}

const topic = (readings: ReturnType<typeof build>, name: ReadingTopic) =>
  readings.find((reading) => reading.topic === name)!

describe('Market Readings — index context', () => {
  it('should add the trend as a reason without touching the stance', () => {
    const plain = build(undefined, undefined)
    const withIndex = build(
      { name: 'Ibovespa', reading: up },
      { name: 'IFIX', reading: null, unavailableDetail: 'só 1 dia' }
    )

    for (const name of [ReadingTopic.STOCKS, ReadingTopic.REAL_ESTATE_FUNDS]) {
      expect(topic(withIndex, name).stance).toBe(topic(plain, name).stance)
    }

    const stocks = topic(withIndex, ReadingTopic.STOCKS)
    const reason = stocks.reasons.find(
      (item) => item.code === 'INDEX_TREND_UP'
    )!

    expect(reason.message).toContain('Ibovespa em tendência de alta')
    expect(reason.message).toContain('+3,10% sobre a média de 200 dias')
    expect(reason.message).toContain('+12,40% em 12 meses')
    expect(reason.message).toContain('2026-10-09')
    expect(reason.message).toContain('não altera a leitura dos juros')
  })

  it('should keep the interest rate reasons first', () => {
    const stocks = topic(
      build({ name: 'Ibovespa', reading: up }, { name: 'IFIX', reading: null }),
      ReadingTopic.STOCKS
    )

    expect(stocks.reasons[0].code).toBe('MARKET_NUMBERS')
    expect(stocks.reasons[stocks.reasons.length - 1].code).toBe(
      'INDEX_TREND_UP'
    )
  })

  it('should replace the no-data premise with the index rule when available', () => {
    const stocks = topic(
      build({ name: 'Ibovespa', reading: up }, { name: 'IFIX', reading: null }),
      ReadingTopic.STOCKS
    )
    const codes = stocks.premises.map((premise) => premise.code)

    expect(codes).not.toContain('NO_EQUITY_MARKET_DATA')
    expect(codes).toEqual(
      expect.arrayContaining(['INDEX_TREND_RULE', 'INDEX_CONTEXT_ONLY'])
    )
  })

  it('should say why the index is unavailable and keep the no-data premise', () => {
    const fii = topic(
      build(
        { name: 'Ibovespa', reading: up },
        {
          name: 'IFIX',
          reading: null,
          unavailableDetail:
            'a fonte entregou 1 dia(s) de cotação e a média de 200 dias exige 200',
        }
      ),
      ReadingTopic.REAL_ESTATE_FUNDS
    )

    expect(
      fii.reasons.find((reason) => reason.code === 'INDEX_UNAVAILABLE')?.message
    ).toContain('Sem tendência do IFIX: a fonte entregou 1 dia(s)')
    expect(
      fii.premises.find((premise) => premise.code === 'NO_EQUITY_MARKET_DATA')
        ?.message
    ).toContain('IFIX')
  })

  it('should describe a downtrend and a mixed trend in plain words', () => {
    const down: IndexReading = {
      ...up,
      return12m: '-8.20',
      vsMovingAverage200: '-4.00',
      trend: IndexTrendDirection.DOWN,
    }
    const mixed: IndexReading = {
      ...up,
      vsMovingAverage200: '-1.00',
      trend: IndexTrendDirection.MIXED,
    }

    const downReason = topic(
      build(
        { name: 'Ibovespa', reading: down },
        { name: 'IFIX', reading: null }
      ),
      ReadingTopic.STOCKS
    ).reasons.find((reason) => reason.code === 'INDEX_TREND_DOWN')!
    const mixedReason = topic(
      build(
        { name: 'Ibovespa', reading: mixed },
        { name: 'IFIX', reading: null }
      ),
      ReadingTopic.STOCKS
    ).reasons.find((reason) => reason.code === 'INDEX_TREND_MIXED')!

    expect(downReason.message).toContain('em tendência de baixa')
    expect(downReason.message).toContain('-4,00% sobre a média')
    expect(downReason.message).toContain('-8,20% em 12 meses')
    expect(mixedReason.message).toContain('sem tendência definida')
  })

  it('should not tell the user to buy or sell on any trend', () => {
    const readings = build(
      { name: 'Ibovespa', reading: up },
      { name: 'IFIX', reading: null }
    )

    for (const reading of readings) {
      for (const item of [...reading.reasons, ...reading.premises]) {
        expect(item.message).not.toMatch(
          /\b(compre|comprar|venda|vender|invista)\b/i
        )
      }
    }
  })

  it('should leave the other topics untouched', () => {
    const plain = build(undefined, undefined)
    const withIndex = build(
      { name: 'Ibovespa', reading: up },
      { name: 'IFIX', reading: null }
    )

    for (const name of [
      ReadingTopic.FIXED_POST,
      ReadingTopic.FIXED_PRE,
      ReadingTopic.FIXED_INFLATION,
      ReadingTopic.TAX_EXEMPT,
    ]) {
      expect(topic(withIndex, name)).toEqual(topic(plain, name))
    }
  })
})
