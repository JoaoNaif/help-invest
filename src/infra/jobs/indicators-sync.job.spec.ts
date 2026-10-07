import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncIndicatorsUseCase } from '@/domain/market-data/applications/use-cases/sync-indicators'
import { FakeMarketDataProvider } from 'test/gateways/fake-market-data-provider'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { EnvService } from '../env/env.service'
import { IndicatorsSyncJob } from './indicators-sync.job'

let indicatorValuesRepository: InMemoryIndicatorValuesRepository
let marketDataProvider: FakeMarketDataProvider
let enabled: boolean
let sut: IndicatorsSyncJob

describe('Indicators Sync Job', () => {
  beforeEach(() => {
    indicatorValuesRepository = new InMemoryIndicatorValuesRepository()
    marketDataProvider = new FakeMarketDataProvider()
    enabled = true

    const env = { get: () => enabled } as unknown as EnvService

    sut = new IndicatorsSyncJob(
      new SyncIndicatorsUseCase(indicatorValuesRepository, marketDataProvider),
      env
    )
  })

  it('should be able to sync the indicators', async () => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    marketDataProvider.series.set('CDI', [
      { date: today, value: new Decimal('14.9') },
    ])

    await sut.run()

    expect(marketDataProvider.calls).toHaveLength(3)
    expect(indicatorValuesRepository.items).toHaveLength(1)
  })

  it('should do nothing when the sync is disabled', async () => {
    enabled = false

    await sut.run()

    expect(marketDataProvider.calls).toHaveLength(0)
  })

  it('should not throw when the data source is down', async () => {
    marketDataProvider.failing.add('CDI')
    marketDataProvider.failing.add('SELIC')
    marketDataProvider.failing.add('IPCA')

    await expect(sut.run()).resolves.toBeUndefined()
  })

  it('should not throw when something unexpected fails', async () => {
    vi.spyOn(indicatorValuesRepository, 'findLatest').mockRejectedValue(
      new Error('database down')
    )

    await expect(sut.run()).resolves.toBeUndefined()

    // e libera a trava para o próximo ciclo
    vi.restoreAllMocks()
    await sut.run()

    expect(marketDataProvider.calls.length).toBeGreaterThan(0)
  })

  it('should skip a run while another one is still going', async () => {
    await Promise.all([sut.run(), sut.run()])

    // 3 indicadores, uma vez só
    expect(marketDataProvider.calls).toHaveLength(3)
  })
})
