import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeIndicatorValue } from 'test/factories/make-indicator-value'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { Indicator } from '../../entities/enums/indicator'
import { MarketSnapshotLoader } from './market-snapshot-loader'

const NOW = new Date('2026-10-10T12:00:00Z')

let indicators: InMemoryIndicatorValuesRepository
let sut: MarketSnapshotLoader

function add(name: Indicator, date: Date, value: string) {
  indicators.items.push(
    makeIndicatorValue({
      indicator: name,
      date,
      value: new Decimal(value),
      source: `BCB SGS ${name}`,
    })
  )
}

function addIpca(lastMonth = 8, count = 12) {
  for (let month = 0; month < count; month++) {
    add(Indicator.IPCA, new Date(Date.UTC(2026, lastMonth - month, 1)), '0.4')
  }
}

describe('Market Snapshot Loader', () => {
  beforeEach(() => {
    indicators = new InMemoryIndicatorValuesRepository()
    sut = new MarketSnapshotLoader(indicators)
  })

  it('should load fresh Selic, CDI, IPCA 12m and the Selic of 6 months ago', async () => {
    add(Indicator.SELIC, new Date('2026-10-09T00:00:00Z'), '14.75')
    add(Indicator.SELIC, new Date('2026-04-10T00:00:00Z'), '15.25')
    add(Indicator.CDI, new Date('2026-10-09T00:00:00Z'), '14.65')
    addIpca()

    const snapshot = await sut.load(NOW)

    expect(snapshot.selic?.value.toString()).toBe('14.75')
    expect(snapshot.cdi?.value.toString()).toBe('14.65')
    expect(snapshot.selicSixMonthsAgo?.value.toString()).toBe('15.25')
    expect(snapshot.ipca12m?.toFixed(2)).toBe('4.91')
    expect(snapshot.ipcaMonths).toHaveLength(12)
    expect(snapshot.sources).toMatchObject({
      SELIC: { value: '14.75', date: '2026-10-09' },
      IPCA_12M: { from: '2025-10-01', to: '2026-09-01' },
    })
  })

  it('should return nulls (never zero) without data', async () => {
    const snapshot = await sut.load(NOW)

    expect(snapshot.selic).toBeNull()
    expect(snapshot.cdi).toBeNull()
    expect(snapshot.selicSixMonthsAgo).toBeNull()
    expect(snapshot.ipca12m).toBeNull()
    expect(snapshot.ipcaMonths).toEqual([])
    expect(snapshot.sources).toEqual({
      SELIC: null,
      CDI: null,
      SELIC_6M_AGO: null,
      IPCA_12M: null,
    })
  })

  it('should drop Selic and CDI older than 7 days', async () => {
    add(Indicator.SELIC, new Date('2026-10-01T00:00:00Z'), '14.75')
    add(Indicator.CDI, new Date('2026-10-01T00:00:00Z'), '14.65')

    const snapshot = await sut.load(NOW)

    expect(snapshot.selic).toBeNull()
    expect(snapshot.cdi).toBeNull()
  })

  it('should not look for history when Selic is stale', async () => {
    add(Indicator.SELIC, new Date('2026-09-01T00:00:00Z'), '14.75')
    add(Indicator.SELIC, new Date('2026-04-10T00:00:00Z'), '15.25')

    const snapshot = await sut.load(NOW)

    expect(snapshot.selicSixMonthsAgo).toBeNull()
  })

  it('should ignore a Selic history point too far from the target date', async () => {
    add(Indicator.SELIC, new Date('2026-10-09T00:00:00Z'), '14.75')
    add(Indicator.SELIC, new Date('2025-05-01T00:00:00Z'), '10.5')

    const snapshot = await sut.load(NOW)

    expect(snapshot.selicSixMonthsAgo).toBeNull()
  })

  it('should not accumulate IPCA with fewer than 12 months', async () => {
    addIpca(8, 11)

    const snapshot = await sut.load(NOW)

    expect(snapshot.ipca12m).toBeNull()
    expect(snapshot.ipcaMonths).toEqual([])
  })

  it('should not accumulate IPCA when the last month is too old', async () => {
    // última leitura em abril/2026: mais de 100 dias
    addIpca(3)

    const snapshot = await sut.load(NOW)

    expect(snapshot.ipca12m).toBeNull()
  })
})
