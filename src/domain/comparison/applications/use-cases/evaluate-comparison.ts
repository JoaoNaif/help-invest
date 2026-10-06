import Decimal from 'decimal.js'
import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { PortfolioRules } from '@/domain/portfolio/services/portfolio-rules'
import { addUtcMonths, daysBetween } from '@/domain/shared/dates'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import {
  ComparisonContext,
  ComparisonRules,
} from '../../services/comparison-rules'
import { IncomeTaxCalculator } from '../../services/income-tax-calculator'
import { MarketReference, RateNormalizer } from '../../services/rate-normalizer'
import { IndicatorUnavailableError } from '../errors/indicator-unavailable-error'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { UnsupportedAssetTypeError } from '../errors/unsupported-asset-type-error'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

/** O comparador do MVP é de renda fixa. */
export const COMPARABLE_ASSET_TYPES: readonly AssetType[] = [
  AssetType.CDB,
  AssetType.LCI,
  AssetType.LCA,
  AssetType.LC,
  AssetType.TESOURO,
  AssetType.DEBENTURE,
  AssetType.CRI,
  AssetType.CRA,
]

/** CDI/Selic mais velhos que isso = job de sincronização parado. */
export const DAILY_INDICATOR_MAX_AGE_DAYS = 7

/** IPCA sai por volta do dia 10 do mês seguinte; o último mês pode ter ~70 dias. */
export const IPCA_MAX_AGE_DAYS = 100

const IPCA_MONTHS = 12

interface EvaluateComparisonUseCaseRequest {
  userId: string
  comparisonId: string
}

type EvaluateComparisonUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidComparisonStatusError
  | UnsupportedAssetTypeError
  | IndicatorUnavailableError,
  { comparison: Comparison; options: ComparisonOption[] }
>

interface LoadedMarket {
  market: MarketReference
  sources: Record<string, unknown>
}

/**
 * UC-16 — ver docs/08-casos-de-uso.md#uc-16--evaluatecomparison
 * O coração do produto: confirma os dados e roda o motor de regras em código.
 * Nada aqui passa pelo LLM.
 */
export class EvaluateComparisonUseCase {
  constructor(
    private comparisonsRepository: ComparisonsRepository,
    private indicatorValuesRepository: IndicatorValuesRepository,
    private positionsRepository: PositionsRepository,
    private investorProfilesRepository: InvestorProfilesRepository
  ) {}

  async execute({
    userId,
    comparisonId,
  }: EvaluateComparisonUseCaseRequest): Promise<EvaluateComparisonUseCaseResponse> {
    const now = new Date()

    const comparison = await this.comparisonsRepository.findById(comparisonId)

    if (!comparison) {
      return left(new ResourceNotFoundError('Comparison'))
    }

    if (comparison.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    if (!comparison.canConfirm) {
      return left(
        new InvalidComparisonStatusError(
          comparison.status,
          ComparisonStatus.DRAFT
        )
      )
    }

    const options =
      await this.comparisonsRepository.findOptionsByComparisonId(comparisonId)

    const unsupported = [
      ...new Set(
        options
          .map((option) => option.assetType)
          .filter((assetType) => !COMPARABLE_ASSET_TYPES.includes(assetType))
      ),
    ]

    if (unsupported.length > 0) {
      return left(new UnsupportedAssetTypeError(unsupported))
    }

    const loaded = await this.loadMarket(
      now,
      options.some((option) => option.indexer === Indexer.IPCA)
    )

    if (loaded.isLeft()) {
      return left(loaded.value)
    }

    const { market, sources } = loaded.value

    const [positions, profile] = await Promise.all([
      this.positionsRepository.findManyByUserId(userId),
      this.investorProfilesRepository.findByUserId(userId),
    ])

    const context: ComparisonContext = {
      amount: comparison.amount,
      now,
      horizonEnd: addUtcMonths(now, comparison.horizonMonths),
      cdi: market.cdi,
      profile,
      portfolio: {
        total: positions.reduce(
          (total, position) => total.plus(position.investedAmount),
          new Decimal(0)
        ),
        byIssuer: PortfolioRules.issuerExposures(positions),
      },
    }

    comparison.confirm()

    const optionAssumptions = options.map((option) =>
      this.evaluateOption(option, market, context)
    )

    comparison.complete({
      evaluatedAt: now.toISOString(),
      amount: comparison.amount.toString(),
      horizonMonths: comparison.horizonMonths,
      indicators: sources,
      options: optionAssumptions,
      notes: [
        '% do CDI e % da Selic: taxa × índice atual (aproximação usual).',
        'IPCA+: inflação futura estimada pelo IPCA acumulado dos últimos 12 meses.',
        'Prazo: até o vencimento; sem vencimento (ou já vencido), até o seu horizonte.',
        'IR regressivo sobre o ganho do período; LCI, LCA, CRI e CRA isentos.',
        'Não considerados: IOF (< 30 dias), taxa de custódia, marcação a mercado.',
      ],
    })

    await this.comparisonsRepository.save(comparison, options)

    const ranked = [...options].sort((a, b) =>
      b.netAnnualRate!.comparedTo(a.netAnnualRate!)
    )

    return right({ comparison, options: ranked })
  }

  private evaluateOption(
    option: ComparisonOption,
    market: MarketReference,
    context: ComparisonContext
  ) {
    const usesMaturity =
      option.maturityAt !== null &&
      option.maturityAt.getTime() > context.now.getTime()

    const holdingDays = daysBetween(
      context.now,
      usesMaturity ? option.maturityAt! : context.horizonEnd
    )

    const grossAnnualRate = RateNormalizer.grossAnnualRate(
      option.indexer,
      option.rate,
      market
    )
    const incomeTaxRate = IncomeTaxCalculator.rateFor(
      option.assetType,
      holdingDays
    )
    const netAnnualRate = IncomeTaxCalculator.netAnnualRate(
      grossAnnualRate,
      incomeTaxRate,
      holdingDays
    )

    option.applyEvaluation(
      netAnnualRate,
      ComparisonRules.alertsFor(
        option,
        { grossAnnualRate, holdingDays },
        context
      )
    )

    return {
      optionId: option.id.toString(),
      holdingDays,
      holdingPeriodBasis: usesMaturity ? 'MATURITY' : 'HORIZON',
      grossAnnualRate: grossAnnualRate.toDecimalPlaces(6).toString(),
      incomeTaxRate: incomeTaxRate.toString(),
      netAnnualRate: netAnnualRate.toString(),
    }
  }

  private async loadMarket(
    now: Date,
    needsIpca: boolean
  ): Promise<Either<IndicatorUnavailableError, LoadedMarket>> {
    const [cdi, selic] = await Promise.all([
      this.indicatorValuesRepository.findLatest(Indicator.CDI),
      this.indicatorValuesRepository.findLatest(Indicator.SELIC),
    ])

    if (!isFresh(cdi, now, DAILY_INDICATOR_MAX_AGE_DAYS)) {
      return left(new IndicatorUnavailableError(Indicator.CDI))
    }

    if (!isFresh(selic, now, DAILY_INDICATOR_MAX_AGE_DAYS)) {
      return left(new IndicatorUnavailableError(Indicator.SELIC))
    }

    const sources: Record<string, unknown> = {
      CDI: describeIndicator(cdi),
      SELIC: describeIndicator(selic),
    }

    let ipca12m: Decimal | null = null

    if (needsIpca) {
      const months = await this.indicatorValuesRepository.findRecent(
        Indicator.IPCA,
        IPCA_MONTHS
      )

      if (
        months.length < IPCA_MONTHS ||
        !isFresh(months[0], now, IPCA_MAX_AGE_DAYS)
      ) {
        return left(new IndicatorUnavailableError(Indicator.IPCA))
      }

      ipca12m = RateNormalizer.accumulate(months.map((month) => month.value))

      sources.IPCA_12M = {
        value: ipca12m.toDecimalPlaces(6).toString(),
        from: months[months.length - 1].date.toISOString().slice(0, 10),
        to: months[0].date.toISOString().slice(0, 10),
        source: months[0].source,
      }
    }

    return right({
      market: { cdi: cdi.value, selic: selic.value, ipca12m },
      sources,
    })
  }
}

function isFresh(
  value: IndicatorValue | null | undefined,
  now: Date,
  maxAgeDays: number
): value is IndicatorValue {
  return !!value && daysBetween(value.date, now) <= maxAgeDays
}

function describeIndicator(value: IndicatorValue) {
  return {
    value: value.value.toString(),
    date: value.date.toISOString().slice(0, 10),
    source: value.source,
  }
}
