import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { makeIndicatorValue } from 'test/factories/make-indicator-value'
import {
  FakeMarketIndexProvider,
  makeIndexCloses,
} from 'test/gateways/fake-market-index-provider'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { Stance } from '../../entities/enums/stance'
import { MarketIndexCode } from '../dtos/market-index'
import { GetMarketOverviewUseCase } from './get-market-overview'

const NOW = new Date('2026-10-10T12:00:00Z')

let indicators: InMemoryIndicatorValuesRepository
let indexProvider: FakeMarketIndexProvider
let sut: GetMarketOverviewUseCase

function add(name: Indicator, date: string, value: string) {
  indicators.items.push(
    makeIndicatorValue({
      indicator: name,
      date: new Date(`${date}T00:00:00Z`),
      value: new Decimal(value),
      source: `BCB SGS ${name}`,
    })
  )
}

/** 12 meses de IPCA de 0,4%, de outubro/2025 a setembro/2026. */
function addIpca() {
  for (let month = 0; month < 12; month++) {
    indicators.items.push(
      makeIndicatorValue({
        indicator: Indicator.IPCA,
        date: new Date(Date.UTC(2026, 8 - month, 1)),
        value: new Decimal('0.4'),
        source: 'BCB SGS 433',
      })
    )
  }
}

/** Selic diária de 14.25 em abril/2026 a 14.75 em outubro/2026. */
function addSelic() {
  add(Indicator.SELIC, '2026-04-10', '15.25')
  add(Indicator.SELIC, '2026-09-15', '14.75')
  add(Indicator.SELIC, '2026-09-30', '14.75')
  add(Indicator.SELIC, '2026-10-09', '14.75')
}

function addAll() {
  addSelic()
  add(Indicator.CDI, '2026-10-09', '14.65')
  addIpca()
}

const readingOf = (
  overview: Awaited<
    ReturnType<GetMarketOverviewUseCase['execute']>
  >['value']['overview'],
  topic: string
) => overview.readings.find((reading) => reading.topic === topic)!

describe('Get Market Overview', () => {
  beforeEach(() => {
    indicators = new InMemoryIndicatorValuesRepository()
    indexProvider = new FakeMarketIndexProvider()
    sut = new GetMarketOverviewUseCase(indicators, indexProvider, () => NOW)
  })

  it('should read rates, trend and readings when there is full data', async () => {
    addAll()

    const { overview } = (await sut.execute()).value

    expect(overview.generatedAt).toBe(NOW.toISOString())
    expect(overview.rates).toEqual({
      selic: { value: '14.75', asOf: '2026-10-09' },
      cdi: { value: '14.65', asOf: '2026-10-09' },
      ipca12m: { value: '4.91', asOf: '2026-09-01' },
      realRate: { value: '9.38' },
      // 15.25 → 14.75: caiu 0,5 ponto
      selicTrend: 'FALLING',
    })
    expect(overview.readings).toHaveLength(6)
    expect(readingOf(overview, 'FIXED_INFLATION').stance).toBe(Stance.FAVORED)
    expect(readingOf(overview, 'FIXED_PRE').stance).toBe(Stance.FAVORED)
    // sem série dos índices: ambos null + alerta, e a leitura vem só dos juros
    expect(overview.market).toEqual({ ibovespa: null, ifix: null })
    expect(overview.alerts.map((alert) => alert.code)).toEqual([
      'INDEX_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'NO_EQUITY_MARKET_DATA',
    ])
    expect(overview.assumptions).toMatchObject({
      realRateHighPercent: '6',
      realRateLowPercent: '3',
      indicators: {
        SELIC: { value: '14.75', date: '2026-10-09' },
        IPCA_12M: { from: '2025-10-01', to: '2026-09-01' },
      },
    })
  })

  it('should build the history: last Selic value per month, IPCA ascending', async () => {
    addAll()

    const { overview } = (await sut.execute()).value

    expect(overview.history.selic).toEqual([
      { date: '2026-04-10', value: '15.25' },
      { date: '2026-09-30', value: '14.75' },
      { date: '2026-10-09', value: '14.75' },
    ])
    expect(overview.history.ipcaMonthly).toHaveLength(12)
    expect(overview.history.ipcaMonthly[0]).toEqual({
      month: '2025-10',
      value: '0.40',
    })
    expect(overview.history.ipcaMonthly[11]).toEqual({
      month: '2026-09',
      value: '0.40',
    })
  })

  it('should keep at most 12 months of Selic history', async () => {
    addAll()

    for (let month = 0; month < 20; month++) {
      indicators.items.push(
        makeIndicatorValue({
          indicator: Indicator.SELIC,
          date: new Date(Date.UTC(2025, 3 - month, 15)),
          value: new Decimal('13'),
          source: 'BCB SGS 432',
        })
      )
    }

    const { overview } = (await sut.execute()).value

    expect(overview.history.selic).toHaveLength(12)
    // o mais novo é o de hoje
    expect(overview.history.selic[11].date).toBe('2026-10-09')
  })

  it('should compute the LCA/LCI equivalence with the requested percentage', async () => {
    addAll()

    const { overview } = (
      await sut.execute({ exemptPercentOfCdi: new Decimal('95') })
    ).value

    expect(overview.equivalences).toHaveLength(1)
    expect(overview.equivalences[0].exemptPercentOfCdi).toBe('95.00')
    expect(overview.equivalences[0].brackets).toHaveLength(4)
    // 95 / (1 − 0,225)
    expect(
      overview.equivalences[0].brackets[0].equivalentTaxedPercentOfCdi
    ).toBe('122.58')
  })

  it('should return nulls and alerts when there is no data at all', async () => {
    const { overview } = (await sut.execute()).value

    expect(overview.rates).toEqual({
      selic: null,
      cdi: null,
      ipca12m: null,
      realRate: null,
      selicTrend: null,
    })
    expect(overview.history).toEqual({ selic: [], ipcaMonthly: [] })
    expect(overview.equivalences).toEqual([])
    expect(
      overview.readings.every(
        (reading) => reading.stance === Stance.UNAVAILABLE
      )
    ).toBe(true)
    expect(overview.alerts.map((alert) => alert.code)).toEqual([
      'MARKET_DATA_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'NO_EQUITY_MARKET_DATA',
    ])
  })

  it('should leave the real rate out without IPCA', async () => {
    addSelic()
    add(Indicator.CDI, '2026-10-09', '14.65')

    const { overview } = (await sut.execute()).value

    expect(overview.rates.ipca12m).toBeNull()
    expect(overview.rates.realRate).toBeNull()
    expect(overview.rates.selic?.value).toBe('14.75')
    expect(overview.equivalences).toHaveLength(1)
    expect(overview.alerts[0].message).toContain('IPCA')
    // a tendência ainda funciona: a regra de Selic em queda dispara
    expect(overview.rates.selicTrend).toBe('FALLING')
    expect(readingOf(overview, 'FIXED_INFLATION').stance).toBe(
      Stance.UNAVAILABLE
    )
  })

  it('should not compute IPCA 12m with a missing month', async () => {
    addAll()
    indicators.items = indicators.items.filter(
      (item) =>
        !(
          item.indicator === Indicator.IPCA &&
          item.date.getTime() === Date.UTC(2026, 3, 1)
        )
    )

    const { overview } = (await sut.execute()).value

    expect(overview.rates.ipca12m).toBeNull()
    expect(overview.rates.realRate).toBeNull()
  })

  it('should alert and skip the trend rules without Selic history', async () => {
    add(Indicator.SELIC, '2026-10-09', '14.75')
    add(Indicator.CDI, '2026-10-09', '14.65')
    addIpca()

    const { overview } = (await sut.execute()).value

    expect(overview.rates.selicTrend).toBeNull()
    expect(overview.alerts.map((alert) => alert.code)).toEqual([
      'SELIC_HISTORY_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'NO_EQUITY_MARKET_DATA',
    ])
    expect(readingOf(overview, 'FIXED_PRE').stance).toBe(Stance.UNAVAILABLE)
    // sem a tendência, o juro real alto ainda favorece o pós-fixado
    expect(readingOf(overview, 'FIXED_POST').stance).toBe(Stance.FAVORED)
  })

  it('should treat stale Selic and CDI as unavailable', async () => {
    add(Indicator.SELIC, '2026-09-01', '14.75')
    add(Indicator.CDI, '2026-09-01', '14.65')
    addIpca()

    const { overview } = (await sut.execute()).value

    expect(overview.rates.selic).toBeNull()
    expect(overview.rates.cdi).toBeNull()
    expect(overview.equivalences).toEqual([])
    expect(overview.alerts[0].code).toBe('MARKET_DATA_UNAVAILABLE')
  })

  describe('market indices (phase B)', () => {
    // Quinta, 2026-10-08: dentro dos 7 dias de tolerância de NOW.
    const LAST = new Date('2026-10-08T00:00:00Z')

    function addIbovespa(startClose: number, endClose: number, days = 500) {
      indexProvider.histories.set(MarketIndexCode.IBOVESPA, {
        code: MarketIndexCode.IBOVESPA,
        source: 'Yahoo Finance (^BVSP)',
        closes: makeIndexCloses(LAST, days, startClose, endClose),
      })
    }

    it('should fill the Ibovespa trend and keep the interest rate stance', async () => {
      addAll()
      const before = (await sut.execute()).value.overview

      addIbovespa(130_000, 209_000)

      const { overview } = (await sut.execute()).value

      expect(overview.market.ibovespa).toMatchObject({
        asOf: '2026-10-08',
        source: 'Yahoo Finance (^BVSP)',
        trend: 'UP',
      })
      expect(Number(overview.market.ibovespa?.return12m)).toBeGreaterThan(0)
      expect(
        Number(overview.market.ibovespa?.vsMovingAverage200)
      ).toBeGreaterThan(0)

      const stocks = readingOf(overview, 'STOCKS')

      // a tendência é contexto: o stance continua o dos juros
      expect(stocks.stance).toBe(readingOf(before, 'STOCKS').stance)
      expect(stocks.reasons.map((reason) => reason.code)).toContain(
        'INDEX_TREND_UP'
      )
      expect(stocks.premises.map((premise) => premise.code)).toEqual(
        expect.arrayContaining(['INDEX_TREND_RULE', 'INDEX_CONTEXT_ONLY'])
      )
      expect(stocks.premises.map((premise) => premise.code)).not.toContain(
        'NO_EQUITY_MARKET_DATA'
      )
    })

    it('should not change any stance because of the index trend', async () => {
      addAll()
      const without = (await sut.execute()).value.overview

      // Ibovespa em forte queda: seria "sinal de venda" se fosse sinal.
      addIbovespa(250_000, 150_000)

      const { overview } = (await sut.execute()).value

      expect(overview.market.ibovespa?.trend).toBe('DOWN')
      expect(
        overview.readings.map((reading) => [reading.topic, reading.stance])
      ).toEqual(
        without.readings.map((reading) => [reading.topic, reading.stance])
      )
    })

    it('should report MIXED when price and return disagree', async () => {
      addAll()
      // Sobe muito em 12 meses, mas as últimas semanas caem abaixo da média.
      const closes = makeIndexCloses(LAST, 500, 100_000, 200_000)

      for (let index = closes.length - 20; index < closes.length; index++) {
        closes[index] = { ...closes[index], close: new Decimal('160000') }
      }

      indexProvider.histories.set(MarketIndexCode.IBOVESPA, {
        code: MarketIndexCode.IBOVESPA,
        source: 'Yahoo Finance (^BVSP)',
        closes,
      })

      const { overview } = (await sut.execute()).value

      expect(overview.market.ibovespa?.trend).toBe('MIXED')
    })

    it('should keep the IFIX null with an alert when the source only has one day', async () => {
      addAll()
      addIbovespa(130_000, 209_000)
      // O que o Yahoo devolve de verdade para IFIX.SA: um único fechamento.
      indexProvider.histories.set(MarketIndexCode.IFIX, {
        code: MarketIndexCode.IFIX,
        source: 'Yahoo Finance (IFIX.SA)',
        closes: makeIndexCloses(LAST, 1, 3988.54, 3988.54),
      })

      const { overview } = (await sut.execute()).value

      expect(overview.market.ifix).toBeNull()
      expect(overview.market.ibovespa).not.toBeNull()

      const alerts = overview.alerts.map((alert) => alert.code)

      expect(alerts).toContain('INDEX_UNAVAILABLE')
      // o Ibovespa chegou: a leitura não vem "só dos juros"
      expect(alerts).not.toContain('NO_EQUITY_MARKET_DATA')

      const ifixAlert = overview.alerts.find(
        (alert) => alert.code === 'INDEX_UNAVAILABLE'
      )!

      expect(ifixAlert.message).toContain('IFIX')
      expect(ifixAlert.message).toContain('1 dia(s)')

      const fii = readingOf(overview, 'REAL_ESTATE_FUNDS')

      expect(fii.reasons.map((reason) => reason.code)).toContain(
        'INDEX_UNAVAILABLE'
      )
      expect(fii.premises.map((premise) => premise.code)).toContain(
        'NO_EQUITY_MARKET_DATA'
      )
    })

    it('should not substitute an unavailable index with another', async () => {
      addAll()
      addIbovespa(130_000, 209_000)

      const { overview } = (await sut.execute()).value

      expect(overview.market.ifix).toBeNull()
      // consultou só os dois índices pedidos, nada de ETF no lugar
      expect([...indexProvider.calls].sort()).toEqual(['IBOVESPA', 'IFIX'])
    })

    it('should treat a stale index quote as unavailable', async () => {
      addAll()
      indexProvider.histories.set(MarketIndexCode.IBOVESPA, {
        code: MarketIndexCode.IBOVESPA,
        source: 'Yahoo Finance (^BVSP)',
        closes: makeIndexCloses(new Date('2026-09-20T00:00:00Z'), 500, 1, 2),
      })

      const { overview } = (await sut.execute()).value

      expect(overview.market.ibovespa).toBeNull()
      expect(
        overview.alerts.find((alert) => alert.code === 'INDEX_UNAVAILABLE')
          ?.message
      ).toContain('mais de 7 dias')
    })

    it('should describe the index rule in the assumptions', async () => {
      addAll()
      addIbovespa(130_000, 209_000)

      const { overview } = (await sut.execute()).value

      expect(overview.assumptions).toMatchObject({
        indices: {
          movingAverageDays: 200,
          returnMonths: 12,
          maxQuoteAgeDays: 7,
          sources: { IBOVESPA: 'Yahoo Finance (^BVSP)' },
        },
      })
    })
  })
})
