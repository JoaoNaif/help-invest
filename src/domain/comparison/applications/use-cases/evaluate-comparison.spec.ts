import Decimal from 'decimal.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { makeComparison } from 'test/factories/make-comparison'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { makeIndicatorValue } from 'test/factories/make-indicator-value'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { InMemoryComparisonsRepository } from 'test/repositories/in-memory-comparisons-repository'
import { InMemoryIndicatorValuesRepository } from 'test/repositories/in-memory-indicator-values-repository'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { IndicatorUnavailableError } from '../errors/indicator-unavailable-error'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { UnsupportedAssetTypeError } from '../errors/unsupported-asset-type-error'
import { EvaluateComparisonUseCase } from './evaluate-comparison'

let comparisonsRepository: InMemoryComparisonsRepository
let indicatorValuesRepository: InMemoryIndicatorValuesRepository
let positionsRepository: InMemoryPositionsRepository
let investorProfilesRepository: InMemoryInvestorProfilesRepository
let sut: EvaluateComparisonUseCase

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const userId = new UniqueEntityId()
const CNPJ_A = '11111111000111'

async function seedDailyIndicators(date = '2026-10-05') {
  await indicatorValuesRepository.createMany([
    makeIndicatorValue({
      indicator: Indicator.CDI,
      date: day(date),
      value: new Decimal('14.90'),
      source: 'BCB SGS 4389',
    }),
    makeIndicatorValue({
      indicator: Indicator.SELIC,
      date: day(date),
      value: new Decimal('15.00'),
      source: 'BCB SGS 432',
    }),
  ])
}

/** 12 meses de 0,5% (set/2025 a ago/2026) → 6,1678% em 12 meses. */
async function seedIpca() {
  await indicatorValuesRepository.createMany(
    Array.from({ length: 12 }, (_, index) =>
      makeIndicatorValue({
        indicator: Indicator.IPCA,
        date: new Date(Date.UTC(2025, 8 + index, 1)),
        value: new Decimal('0.5'),
        source: 'BCB SGS 433',
      })
    )
  )
}

async function createComparison(
  options: Parameters<typeof makeComparisonOption>[0][],
  overrides: Parameters<typeof makeComparison>[0] = {}
) {
  const comparison = makeComparison({
    userId,
    amount: new Decimal('10000'),
    horizonMonths: 24,
    ...overrides,
  })
  const created = options.map((option) =>
    makeComparisonOption({
      comparisonId: comparison.id,
      liquidity: Liquidity.DAILY,
      graceDays: null,
      minAmount: null,
      ...option,
    })
  )
  await comparisonsRepository.create(comparison, created)

  return { comparison, options: created }
}

function execute(comparison: Comparison, asUser = userId) {
  return sut.execute({
    userId: asUser.toString(),
    comparisonId: comparison.id.toString(),
  })
}

function optionAssumption(comparison: Comparison, option: ComparisonOption) {
  const options = comparison.assumptions?.options as {
    optionId: string
    holdingDays: number
    holdingPeriodBasis: string
    grossAnnualRate: string
    incomeTaxRate: string
    netAnnualRate: string
  }[]

  return options.find((item) => item.optionId === option.id.toString())!
}

describe('Evaluate Comparison', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))

    comparisonsRepository = new InMemoryComparisonsRepository()
    indicatorValuesRepository = new InMemoryIndicatorValuesRepository()
    positionsRepository = new InMemoryPositionsRepository()
    investorProfilesRepository = new InMemoryInvestorProfilesRepository()
    sut = new EvaluateComparisonUseCase(
      comparisonsRepository,
      indicatorValuesRepository,
      positionsRepository,
      investorProfilesRepository
    )

    await seedDailyIndicators()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should compute the net rate and rank the options', async () => {
    const { comparison, options } = await createComparison([
      // LCI isenta: 92% × 14,90 = 13,708% líquido
      {
        assetType: AssetType.LCI,
        indexer: Indexer.CDI,
        rate: new Decimal('92'),
        maturityAt: day('2028-10-05'),
      },
      // CDB 110% CDI por 730 dias, IR 15% → 14,0817% líquido
      {
        assetType: AssetType.CDB,
        indexer: Indexer.CDI,
        rate: new Decimal('110'),
        maturityAt: day('2028-10-05'),
      },
    ])
    const [lci, cdb] = options

    const result = await execute(comparison)

    expect(result.isRight()).toBe(true)
    if (result.isLeft()) return

    expect(result.value.options).toEqual([cdb, lci])
    expect(cdb.netAnnualRate?.toFixed(4)).toBe('14.0817')
    expect(lci.netAnnualRate?.equals('13.708')).toBe(true)
    expect(optionAssumption(comparison, cdb)).toMatchObject({
      holdingDays: 730,
      holdingPeriodBasis: 'MATURITY',
      grossAnnualRate: '16.39',
      incomeTaxRate: '15',
    })
  })

  it('should finish the comparison and record the assumptions', async () => {
    const { comparison } = await createComparison([
      { indexer: Indexer.CDI, rate: new Decimal('100') },
    ])

    await execute(comparison)

    expect(comparison.status).toBe(ComparisonStatus.DONE)
    expect(comparison.assumptions).toMatchObject({
      indicators: {
        CDI: { value: '14.9', date: '2026-10-05', source: 'BCB SGS 4389' },
        SELIC: { value: '15', date: '2026-10-05', source: 'BCB SGS 432' },
      },
    })
    expect(comparison.assumptions?.notes).toEqual(
      expect.arrayContaining([expect.stringContaining('IOF')])
    )
    expect(comparisonsRepository.items[0].status).toBe(ComparisonStatus.DONE)
  })

  it('should use the user horizon when the option has no maturity', async () => {
    const { comparison, options } = await createComparison(
      [{ assetType: AssetType.CDB, maturityAt: null }],
      { horizonMonths: 12 }
    )

    await execute(comparison)

    expect(optionAssumption(comparison, options[0])).toMatchObject({
      holdingDays: 365,
      holdingPeriodBasis: 'HORIZON',
      incomeTaxRate: '17.5',
    })
  })

  it('should use the last 12 months of IPCA for IPCA+ options', async () => {
    await seedIpca()
    const { comparison, options } = await createComparison([
      {
        assetType: AssetType.CDB,
        indexer: Indexer.IPCA,
        rate: new Decimal('6.5'),
      },
    ])

    await execute(comparison)

    // (1,061678 × 1,065) − 1 = 13,0687%
    const assumption = optionAssumption(comparison, options[0])
    expect(new Decimal(assumption.grossAnnualRate).toFixed(4)).toBe('13.0687')
    expect(comparison.assumptions?.indicators).toMatchObject({
      IPCA_12M: { from: '2025-09-01', to: '2026-08-01' },
    })
  })

  it('should cross the options with the user portfolio and profile', async () => {
    await positionsRepository.create(
      makePosition({
        userId,
        assetType: AssetType.CDB,
        issuerCnpj: CNPJ_A,
        investedAmount: new Decimal('245000'),
      })
    )
    await investorProfilesRepository.create(
      makeInvestorProfile({
        userId,
        monthlyIncome: new Decimal('10000'),
        emergencyReserve: new Decimal('1000'),
      })
    )
    const { comparison, options } = await createComparison([
      {
        assetType: AssetType.CDB,
        issuerCnpj: CNPJ_A,
        liquidity: Liquidity.AT_MATURITY,
      },
    ])

    await execute(comparison)

    const codes = options[0].alerts.map((alert) => alert.code)
    expect(codes).toContain('ABOVE_FGC_LIMIT')
    expect(codes).toContain('ISSUER_CONCENTRATION')
    expect(codes).toContain('LOW_LIQUIDITY_NO_RESERVE')
  })

  it('should ignore positions of other users', async () => {
    await positionsRepository.create(
      makePosition({
        assetType: AssetType.CDB,
        issuerCnpj: CNPJ_A,
        investedAmount: new Decimal('245000'),
      })
    )
    const { comparison, options } = await createComparison([
      { assetType: AssetType.CDB, issuerCnpj: CNPJ_A },
    ])

    await execute(comparison)

    expect(options[0].alerts.map((alert) => alert.code)).not.toContain(
      'ABOVE_FGC_LIMIT'
    )
  })

  describe('market data', () => {
    it('should fail without a recent CDI and keep the draft', async () => {
      indicatorValuesRepository.items = []
      await seedDailyIndicators('2026-09-20')
      const { comparison } = await createComparison([{}])

      const result = await execute(comparison)

      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(IndicatorUnavailableError)
      expect(comparison.status).toBe(ComparisonStatus.DRAFT)
    })

    it('should require 12 months of IPCA only when an option uses IPCA', async () => {
      const cdiOnly = await createComparison([{ indexer: Indexer.CDI }])
      const withIpca = await createComparison([{ indexer: Indexer.IPCA }])

      expect((await execute(cdiOnly.comparison)).isRight()).toBe(true)

      const result = await execute(withIpca.comparison)
      expect(result.isLeft()).toBe(true)
      expect(result.value).toBeInstanceOf(IndicatorUnavailableError)
    })
  })

  it('should only evaluate fixed income', async () => {
    const { comparison } = await createComparison([
      { assetType: AssetType.CDB },
      { assetType: AssetType.ACAO },
    ])

    const result = await execute(comparison)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(UnsupportedAssetTypeError)
  })

  it('should only evaluate a draft', async () => {
    const { comparison } = await createComparison([{}])
    await execute(comparison)

    const result = await execute(comparison)

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(InvalidComparisonStatusError)
  })

  it('should not evaluate a comparison from another user', async () => {
    const { comparison } = await createComparison([{}])

    const result = await execute(comparison, new UniqueEntityId())

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(NotAllowedError)
    expect(comparison.status).toBe(ComparisonStatus.DRAFT)
  })

  it('should return not found for an unknown comparison', async () => {
    const result = await sut.execute({
      userId: userId.toString(),
      comparisonId: 'unknown-id',
    })

    expect(result.isLeft()).toBe(true)
    expect(result.value).toBeInstanceOf(ResourceNotFoundError)
  })
})
