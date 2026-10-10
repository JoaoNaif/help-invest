import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { MarketDataUnavailableError } from '@/domain/market-data/applications/errors/market-data-unavailable-error'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { makeStockSnapshot } from 'test/factories/make-stock-snapshot'
import { FakeStockDataProvider } from 'test/gateways/fake-stock-data-provider'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { InMemoryStockAnalysesRepository } from 'test/repositories/in-memory-stock-analyses-repository'
import { InvalidStockAnalysisRequestError } from '../errors/invalid-stock-analysis-request-error'
import { TickerNotFoundError } from '../errors/ticker-not-found-error'
import { CreateStockAnalysisUseCase } from './create-stock-analysis'

const NOW = new Date('2026-10-10T12:00:00Z')

let provider: FakeStockDataProvider
let analyses: InMemoryStockAnalysesRepository
let positions: InMemoryPositionsRepository
let profiles: InMemoryInvestorProfilesRepository
let sut: CreateStockAnalysisUseCase

function addBanks() {
  provider.snapshots.set('BBAS3', makeStockSnapshot({ ticker: 'BBAS3' }))
  provider.snapshots.set(
    'ITUB4',
    makeStockSnapshot({
      ticker: 'ITUB4',
      name: 'Itaú',
      price: new Decimal('50'),
      fundamentals: {
        priceToEarnings: new Decimal('12'),
        priceToBook: new Decimal('2'),
        earningsPerShare: new Decimal('4'),
        bookValuePerShare: new Decimal('20'),
        returnOnEquity: new Decimal('20'),
      },
    })
  )
  provider.snapshots.set(
    'BBDC4',
    makeStockSnapshot({
      ticker: 'BBDC4',
      fundamentals: {
        priceToEarnings: new Decimal('14'),
        priceToBook: new Decimal('1.4'),
        earningsPerShare: new Decimal('1.5'),
        bookValuePerShare: new Decimal('17'),
        returnOnEquity: new Decimal('14'),
      },
    })
  )
  provider.snapshots.set('SANB11', makeStockSnapshot({ ticker: 'SANB11' }))
}

describe('Create Stock Analysis', () => {
  beforeEach(() => {
    provider = new FakeStockDataProvider()
    analyses = new InMemoryStockAnalysesRepository()
    positions = new InMemoryPositionsRepository()
    profiles = new InMemoryInvestorProfilesRepository()
    sut = new CreateStockAnalysisUseCase(
      provider,
      analyses,
      positions,
      profiles,
      () => NOW
    )
  })

  it('should be able to analyze a single stock and save it', async () => {
    addBanks()

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3', amount: new Decimal('5000') }],
    })

    expect(result.isRight()).toBe(true)
    expect(analyses.items).toHaveLength(1)

    if (result.isRight()) {
      const { analysis } = result.value
      const [item] = analysis.result.items

      expect(analysis.userId.toString()).toBe('user-1')
      expect(analysis.tickers).toEqual(['BBAS3'])
      expect(item.ticker).toBe('BBAS3')
      expect(item.plannedAmount).toBe('5000.00')
      // R$ 2,00 / R$ 25,00 = 8%, calculado por nós
      expect(item.dividends.trailing12mYield).toBe('8.00')
      expect(item.dividends.consistent).toBe(true)
      expect(item.dividends.dateKind).toBe('EX')
      // Bazin: 2,00 / 6% = 33,33
      expect(item.ceilingPrices.map((c) => c.method)).toEqual([
        'BAZIN',
        'GRAHAM',
      ])
      expect(item.ceilingPrices[0].value).toBe('33.33')
      expect(item.consensus?.analystCount).toBe(13)
      expect(analysis.assumptions).toMatchObject({
        bazinRequiredYieldPercent: '6',
        dividendsAreGross: true,
        sources: ['Fake Yahoo'],
      })
    }
  })

  it('should compare the stock with the peers of its group', async () => {
    addBanks()

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const { valuation } = result.value.analysis.result.items[0]

      expect(valuation.group).toBe('bancos')
      expect(valuation.peers.map((peer) => peer.ticker).sort()).toEqual([
        'BBDC4',
        'ITUB4',
        'SANB11',
      ])
      // P/L: 10 contra mediana de (12, 14, 10) = 12 → −16,67% → barato
      expect(valuation.priceToEarnings.peerMedian).toBe('12.00')
      expect(valuation.priceToEarnings.verdict).toBe('CHEAP')
      // P/VP: 1 contra mediana de (2, 1.4, 1) = 1.4 → barato
      expect(valuation.priceToBook.verdict).toBe('CHEAP')
      expect(valuation.peersUnavailable).toEqual([])
    }
  })

  it('should fetch each ticker once when two stocks share a group', async () => {
    addBanks()

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }, { ticker: 'ITUB4' }],
    })

    expect(result.isRight()).toBe(true)
    expect([...provider.calls].sort()).toEqual([
      'BBAS3',
      'BBDC4',
      'ITUB4',
      'SANB11',
    ])
  })

  it('should warn that two stocks of the same sector do not diversify', async () => {
    addBanks()

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }, { ticker: 'ITUB4' }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const codes = result.value.analysis.result.alerts.map((a) => a.code)

      expect(codes).toContain('SAME_SECTOR')
      expect(result.value.analysis.tickers).toEqual(['BBAS3', 'ITUB4'])
    }
  })

  it('should keep going when a peer is unavailable', async () => {
    addBanks()
    provider.failing.add('SANB11')

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const { valuation } = result.value.analysis.result.items[0]

      expect(valuation.peersUnavailable).toEqual(['SANB11'])
      expect(valuation.peers).toHaveLength(2)
    }
  })

  it('should fail when the requested stock source is down', async () => {
    addBanks()
    provider.failing.add('BBAS3')

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }],
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(MarketDataUnavailableError)
    expect(analyses.items).toHaveLength(0)
  })

  it('should fail when the ticker does not exist', async () => {
    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'ZZZZ3' }],
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(TickerNotFoundError)
  })

  it('should normalize tickers and analyze stocks without a peer group', async () => {
    provider.snapshots.set('PETR4', makeStockSnapshot({ ticker: 'PETR4' }))

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: ' petr4 ' }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const [item] = result.value.analysis.result.items

      expect(result.value.analysis.tickers).toEqual(['PETR4'])
      expect(item.valuation.group).toBeNull()
      expect(item.alerts.map((a) => a.code)).toContain('NO_PEERS')
    }
  })

  it.each([
    ['no tickers', []],
    [
      'more than two tickers',
      [{ ticker: 'BBAS3' }, { ticker: 'ITUB4' }, { ticker: 'BBDC4' }],
    ],
    ['duplicated tickers', [{ ticker: 'BBAS3' }, { ticker: 'bbas3' }]],
    ['an empty ticker', [{ ticker: '  ' }]],
    ['a non-positive amount', [{ ticker: 'BBAS3', amount: new Decimal(0) }]],
  ])('should reject %s without calling the source', async (_, items) => {
    const result = await sut.execute({ userId: 'user-1', items })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidStockAnalysisRequestError)
    expect(provider.calls).toHaveLength(0)
    expect(analyses.items).toHaveLength(0)
  })

  it('should cross the stock with the portfolio of the user', async () => {
    addBanks()
    const userId = new UniqueEntityId('user-1')
    positions.items.push(
      makePosition({
        userId,
        assetType: AssetType.ACAO,
        name: 'ITUB4 - Itaú',
        investedAmount: new Decimal('30000'),
      }),
      makePosition({
        userId,
        assetType: AssetType.CDB,
        name: 'CDB Banco X',
        investedAmount: new Decimal('70000'),
      }),
      // de outro usuário: não pode entrar na conta
      makePosition({
        userId: new UniqueEntityId('other'),
        assetType: AssetType.ACAO,
        name: 'BBAS3',
        investedAmount: new Decimal('900000'),
      })
    )

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3', amount: new Decimal('20000') }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const codes = result.value.analysis.result.items[0].alerts.map(
        (a) => a.code
      )

      // bancos: (30.000 + 20.000) / (100.000 + 20.000) = 41,7% > 35%
      expect(codes).toContain('SECTOR_CONCENTRATION')
      expect(codes).not.toContain('ALREADY_HOLDS')
    }
  })

  it('should add profile alerts to the analysis', async () => {
    addBanks()
    profiles.items.push(
      makeInvestorProfile({
        userId: new UniqueEntityId('user-1'),
        monthlyIncome: new Decimal('10000'),
        emergencyReserve: new Decimal('5000'),
        horizonMonths: 12,
      })
    )

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }],
    })

    expect(result.isRight()).toBe(true)

    if (result.isRight()) {
      const codes = result.value.analysis.result.alerts.map((a) => a.code)

      expect(codes).toContain('LOW_RESERVE_FOR_STOCKS')
      expect(codes).toContain('SHORT_HORIZON_FOR_STOCKS')
      expect(codes).not.toContain('PROFILE_MISSING')
    }
  })

  it('should ask for a profile when the user has none', async () => {
    addBanks()

    const result = await sut.execute({
      userId: 'user-1',
      items: [{ ticker: 'BBAS3' }],
    })

    expect(result.isRight()).toBe(true)
    expect(
      result.isRight() && result.value.analysis.result.alerts.map((a) => a.code)
    ).toContain('PROFILE_MISSING')
  })
})
