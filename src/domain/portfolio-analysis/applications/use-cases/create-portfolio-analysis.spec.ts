import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { makeIndicatorValue } from 'test/factories/make-indicator-value'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InMemoryPortfolioAnalysesRepository } from 'test/repositories/in-memory-portfolio-analyses-repository'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { PortfolioStrategy } from '../../entities/enums/portfolio-strategy'
import { CreatePortfolioAnalysisUseCase } from './create-portfolio-analysis'

const NOW = new Date('2026-10-10T12:00:00Z')

let positions: InMemoryPositionsRepository
let profiles: InMemoryInvestorProfilesRepository
let indicators: InMemoryIndicatorValuesRepository
let analyses: InMemoryPortfolioAnalysesRepository
let sut: CreatePortfolioAnalysisUseCase

function indicator(name: Indicator, date: string, value: string) {
  return makeIndicatorValue({
    indicator: name,
    date: new Date(`${date}T00:00:00Z`),
    value: new Decimal(value),
    source: `BCB SGS ${name}`,
  })
}

/** 12 meses de IPCA de 0,4% (≈ 4,9% no ano), terminando em setembro/2026. */
function addIpca() {
  for (let month = 0; month < 12; month++) {
    const date = new Date(Date.UTC(2026, 8 - month, 1))

    indicators.items.push(
      makeIndicatorValue({
        indicator: Indicator.IPCA,
        date,
        value: new Decimal('0.4'),
        source: 'BCB SGS 433',
      })
    )
  }
}

function addSelicAndCdi() {
  indicators.items.push(
    indicator(Indicator.SELIC, '2026-10-09', '14.75'),
    indicator(Indicator.CDI, '2026-10-09', '14.65'),
    // ~6 meses antes (2026-04-10)
    indicator(Indicator.SELIC, '2026-04-10', '15.25')
  )
}

describe('Create Portfolio Analysis', () => {
  beforeEach(() => {
    positions = new InMemoryPositionsRepository()
    profiles = new InMemoryInvestorProfilesRepository()
    indicators = new InMemoryIndicatorValuesRepository()
    analyses = new InMemoryPortfolioAnalysesRepository()
    sut = new CreatePortfolioAnalysisUseCase(
      positions,
      profiles,
      indicators,
      analyses,
      () => NOW
    )
  })

  it('should be able to analyze the portfolio and save the snapshot', async () => {
    addSelicAndCdi()
    addIpca()

    const profile = makeInvestorProfile()
    await profiles.create(profile)
    await positions.create(
      makePosition({
        userId: profile.userId,
        assetType: AssetType.CDB,
        indexer: Indexer.CDI,
        investedAmount: new Decimal('10000'),
      })
    )

    const result = await sut.execute({
      userId: profile.userId.toString(),
      strategy: PortfolioStrategy.BALANCE,
    })

    expect(result.isRight()).toBe(true)
    expect(analyses.items).toHaveLength(1)

    const { analysis } = result.value

    expect(analysis.strategy).toBe('BALANCE')
    expect(analysis.result.total).toBe('10000.00')
    expect(analysis.result.profileUsed.isDefault).toBe(false)
    expect(analysis.result.market.selic).toBe('14.75')
    expect(analysis.result.market.ipca12m).toBe('4.91')
    expect(analysis.result.market.selicTrend).toBe('FALLING')
    expect(analysis.result.market.ipcaAsOf).toBe('2026-09-01')
    expect(analysis.assumptions).toMatchObject({
      strategy: 'BALANCE',
      analyzedAt: NOW.toISOString(),
      indicators: {
        SELIC: { value: '14.75', date: '2026-10-09' },
        SELIC_6M_AGO: { value: '15.25', date: '2026-04-10' },
        IPCA_12M: { from: '2025-10-01', to: '2026-09-01' },
      },
    })
  })

  it('should analyze an empty portfolio without a profile', async () => {
    addSelicAndCdi()
    addIpca()

    const result = await sut.execute({
      userId: 'user-without-data',
      strategy: PortfolioStrategy.INCOME,
    })

    expect(result.isRight()).toBe(true)

    const { report } = {
      report: result.value.analysis.result,
    }

    expect(report.profileUsed.isDefault).toBe(true)
    expect(report.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining(['PORTFOLIO_EMPTY', 'PROFILE_MISSING'])
    )
  })

  it('should only read the positions of the user', async () => {
    addSelicAndCdi()
    addIpca()

    await positions.create(
      makePosition({ investedAmount: new Decimal('9999') })
    )

    const result = await sut.execute({
      userId: 'someone-else',
      strategy: PortfolioStrategy.BALANCE,
    })

    expect(result.value.analysis.result.total).toBe('0.00')
  })

  it('should still analyze when there is no market data at all', async () => {
    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    expect(result.isRight()).toBe(true)

    const { market, alerts } = result.value.analysis.result

    expect(market.selic).toBeNull()
    expect(market.realRate).toBeNull()
    expect(market.selicTrend).toBeNull()
    expect(alerts.map((alert) => alert.code)).toContain(
      'MARKET_DATA_UNAVAILABLE'
    )
  })

  it('should not fire the trend rule without Selic history', async () => {
    indicators.items.push(
      indicator(Indicator.SELIC, '2026-10-09', '14.75'),
      indicator(Indicator.CDI, '2026-10-09', '14.65')
    )
    addIpca()

    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    const { market } = result.value.analysis.result

    expect(market.selic).toBe('14.75')
    expect(market.selicTrend).toBeNull()
    expect(market.realRate).not.toBeNull()
  })

  it('should ignore a Selic history point that is too far from 6 months ago', async () => {
    indicators.items.push(
      indicator(Indicator.SELIC, '2026-10-09', '14.75'),
      // quase 1 ano antes do alvo (2026-04-10)
      indicator(Indicator.SELIC, '2025-05-01', '10.5')
    )

    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    expect(result.value.analysis.result.market.selicTrend).toBeNull()
  })

  it('should ignore stale Selic and CDI', async () => {
    indicators.items.push(
      indicator(Indicator.SELIC, '2026-09-01', '14.75'),
      indicator(Indicator.CDI, '2026-09-01', '14.65')
    )

    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    const { market } = result.value.analysis.result

    expect(market.selic).toBeNull()
    expect(market.cdi).toBeNull()
    expect(market.asOf).toBeNull()
  })

  it('should not compute IPCA 12m with a missing month', async () => {
    indicators.items.push(indicator(Indicator.SELIC, '2026-10-09', '14.75'))
    addIpca()
    // abre um buraco: tira abril/2026
    indicators.items = indicators.items.filter(
      (item) =>
        !(
          item.indicator === Indicator.IPCA &&
          item.date.getTime() === Date.UTC(2026, 3, 1)
        )
    )

    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    const { market } = result.value.analysis.result

    expect(market.ipca12m).toBeNull()
    expect(market.realRate).toBeNull()
  })

  it('should not compute IPCA 12m with an old last month', async () => {
    indicators.items.push(indicator(Indicator.SELIC, '2026-10-09', '14.75'))

    for (let month = 0; month < 12; month++) {
      indicators.items.push(
        makeIndicatorValue({
          indicator: Indicator.IPCA,
          // última leitura em abril/2026: > 100 dias
          date: new Date(Date.UTC(2026, 3 - month, 1)),
          value: new Decimal('0.4'),
        })
      )
    }

    const result = await sut.execute({
      userId: 'user-1',
      strategy: PortfolioStrategy.BALANCE,
    })

    expect(result.value.analysis.result.market.ipca12m).toBeNull()
  })
})
