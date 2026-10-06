import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { FakeMarketDataProvider } from 'test/gateways/fake-market-data-provider'
import { makeIndicatorValue } from 'test/factories/make-indicator-value'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { MarketDataUnavailableError } from '../errors/market-data-unavailable-error'
import { Indicator } from '../../entities/enums/indicator'
import { SyncIndicatorsUseCase } from './sync-indicators'

let inMemoryIndicatorValuesRepository: InMemoryIndicatorValuesRepository
let fakeMarketDataProvider: FakeMarketDataProvider
let sut: SyncIndicatorsUseCase

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const point = (iso: string, value: string) => ({
  date: day(iso),
  value: new Decimal(value),
})

describe('Sync Indicators', () => {
  const until = new Date('2026-10-06T15:30:00Z')

  beforeEach(() => {
    inMemoryIndicatorValuesRepository = new InMemoryIndicatorValuesRepository()
    fakeMarketDataProvider = new FakeMarketDataProvider()
    sut = new SyncIndicatorsUseCase(
      inMemoryIndicatorValuesRepository,
      fakeMarketDataProvider
    )
  })

  it('should fetch 5 years of history on the first sync', async () => {
    fakeMarketDataProvider.series.set(Indicator.CDI, [
      point('2026-10-02', '14.90'),
      point('2026-10-05', '14.90'),
    ])

    const result = await sut.execute({ indicators: [Indicator.CDI], until })

    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual({
      synced: [{ indicator: Indicator.CDI, inserted: 2 }],
      failed: [],
    })
    expect(fakeMarketDataProvider.calls[0]).toEqual({
      indicator: Indicator.CDI,
      from: day('2021-10-06'),
      to: day('2026-10-06'),
    })
  })

  it('should store value, date and source of each point', async () => {
    fakeMarketDataProvider.series.set(Indicator.SELIC, [
      point('2026-10-05', '15.00'),
    ])

    await sut.execute({ indicators: [Indicator.SELIC], until })

    const [stored] = inMemoryIndicatorValuesRepository.items
    expect(stored.indicator).toBe(Indicator.SELIC)
    expect(stored.date).toEqual(day('2026-10-05'))
    expect(stored.value.equals('15')).toBe(true)
    expect(stored.source).toBe('Fake BCB SELIC')
  })

  it('should only fetch what comes after the last stored date', async () => {
    await inMemoryIndicatorValuesRepository.createMany([
      makeIndicatorValue({ indicator: Indicator.CDI, date: day('2026-10-01') }),
    ])
    fakeMarketDataProvider.series.set(Indicator.CDI, [
      point('2026-10-01', '14.90'),
      point('2026-10-02', '14.90'),
    ])

    const result = await sut.execute({ indicators: [Indicator.CDI], until })

    expect(fakeMarketDataProvider.calls[0].from).toEqual(day('2026-10-02'))
    expect(result.value.synced).toEqual([
      { indicator: Indicator.CDI, inserted: 1 },
    ])
    expect(inMemoryIndicatorValuesRepository.items).toHaveLength(2)
  })

  it('should not call the source when already up to date', async () => {
    await inMemoryIndicatorValuesRepository.createMany([
      makeIndicatorValue({ indicator: Indicator.CDI, date: day('2026-10-06') }),
    ])

    const result = await sut.execute({ indicators: [Indicator.CDI], until })

    expect(fakeMarketDataProvider.calls).toHaveLength(0)
    expect(result.value.synced).toEqual([
      { indicator: Indicator.CDI, inserted: 0 },
    ])
  })

  it('should keep syncing the others when one indicator fails', async () => {
    fakeMarketDataProvider.failing.add(Indicator.CDI)
    fakeMarketDataProvider.series.set(Indicator.SELIC, [
      point('2026-10-05', '15.00'),
    ])
    fakeMarketDataProvider.series.set(Indicator.IPCA, [
      point('2026-09-01', '0.48'),
    ])

    const result = await sut.execute({ until })

    expect(result.isRight()).toBe(true)
    expect(result.value.failed).toHaveLength(1)
    expect(result.value.failed[0].indicator).toBe(Indicator.CDI)
    expect(result.value.failed[0].error).toBeInstanceOf(
      MarketDataUnavailableError
    )
    expect(result.value.synced).toEqual([
      { indicator: Indicator.SELIC, inserted: 1 },
      { indicator: Indicator.IPCA, inserted: 1 },
    ])
  })

  it('should sync all indicators by default', async () => {
    await sut.execute({ until })

    expect(fakeMarketDataProvider.calls.map((call) => call.indicator)).toEqual([
      Indicator.SELIC,
      Indicator.CDI,
      Indicator.IPCA,
    ])
  })
})
