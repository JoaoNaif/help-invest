import { Either, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  DAILY_INDICATOR_MAX_AGE_DAYS,
  IPCA_MAX_AGE_DAYS,
} from '@/domain/comparison/applications/use-cases/evaluate-comparison'
import { RateNormalizer } from '@/domain/comparison/services/rate-normalizer'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { addUtcMonths, daysBetween, startOfUtcDay } from '@/domain/shared/dates'
import { PortfolioStrategy } from '../../entities/enums/portfolio-strategy'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'
import {
  MarketReading,
  PortfolioAnalyzer,
} from '../../services/portfolio-analyzer'
import {
  SELIC_HISTORY_MAX_GAP_DAYS,
  SELIC_TREND_MONTHS,
} from '../../services/market-scenario'
import { PortfolioAnalysesRepository } from '../repositories/portfolio-analyses-repository'

const IPCA_MONTHS = 12

interface CreatePortfolioAnalysisUseCaseRequest {
  userId: string
  strategy: PortfolioStrategy
}

/** Sempre `right`: dado de mercado ausente vira `null` + alerta, nunca erro. */
type CreatePortfolioAnalysisUseCaseResponse = Either<
  never,
  { analysis: PortfolioAnalysis }
>

interface LoadedMarket {
  reading: MarketReading
  sources: Record<string, unknown>
}

/**
 * Compara a carteira atual com a faixa-alvo do perfil e da estratégia, olha o
 * cenário de juros e devolve os caminhos ranqueados. Números e regras vêm só
 * do código; o LLM não participa (a explicação é outro use-case). O perfil e
 * o mercado nunca bloqueiam: sem perfil vale o padrão, sem dado vira `null`.
 */
export class CreatePortfolioAnalysisUseCase {
  constructor(
    private positionsRepository: PositionsRepository,
    private investorProfilesRepository: InvestorProfilesRepository,
    private indicatorValuesRepository: IndicatorValuesRepository,
    private portfolioAnalysesRepository: PortfolioAnalysesRepository,
    private now: () => Date = () => new Date()
  ) {}

  async execute({
    userId,
    strategy,
  }: CreatePortfolioAnalysisUseCaseRequest): Promise<CreatePortfolioAnalysisUseCaseResponse> {
    const now = this.now()

    const [positions, profile, market] = await Promise.all([
      this.positionsRepository.findManyByUserId(userId),
      this.investorProfilesRepository.findByUserId(userId),
      this.loadMarket(now),
    ])

    const { report, assumptions } = PortfolioAnalyzer.analyze({
      positions,
      profile,
      strategy,
      market: market.reading,
      now,
    })

    const analysis = PortfolioAnalysis.create({
      userId: new UniqueEntityId(userId),
      strategy,
      result: report,
      assumptions: {
        ...assumptions,
        analyzedAt: now.toISOString(),
        indicators: market.sources,
      },
    })

    await this.portfolioAnalysesRepository.create(analysis)

    return right({ analysis })
  }

  private async loadMarket(now: Date): Promise<LoadedMarket> {
    const [selic, cdi, ipcaMonths] = await Promise.all([
      this.indicatorValuesRepository.findLatest(Indicator.SELIC),
      this.indicatorValuesRepository.findLatest(Indicator.CDI),
      this.indicatorValuesRepository.findRecent(Indicator.IPCA, IPCA_MONTHS),
    ])

    const freshSelic = isFresh(selic, now, DAILY_INDICATOR_MAX_AGE_DAYS)
      ? selic
      : null
    const freshCdi = isFresh(cdi, now, DAILY_INDICATOR_MAX_AGE_DAYS)
      ? cdi
      : null

    const sources: Record<string, unknown> = {
      SELIC: describe(freshSelic),
      CDI: describe(freshCdi),
    }

    // Selic de ~6 meses atrás, para a tendência. Sem histórico = sem tendência.
    let pastSelic: IndicatorValue | null = null

    if (freshSelic) {
      const target = startOfUtcDay(addUtcMonths(now, -SELIC_TREND_MONTHS))
      const found = await this.indicatorValuesRepository.findOnOrBefore(
        Indicator.SELIC,
        target
      )

      if (
        found &&
        daysBetween(found.date, target) <= SELIC_HISTORY_MAX_GAP_DAYS
      ) {
        pastSelic = found
      }
    }

    sources.SELIC_6M_AGO = describe(pastSelic)

    // IPCA 12m só com 12 meses seguidos e o último não muito velho.
    const hasIpca12m =
      ipcaMonths.length === IPCA_MONTHS &&
      isFresh(ipcaMonths[0], now, IPCA_MAX_AGE_DAYS) &&
      areConsecutiveMonths(ipcaMonths)

    const ipca12m = hasIpca12m
      ? RateNormalizer.accumulate(ipcaMonths.map((month) => month.value))
      : null

    sources.IPCA_12M = hasIpca12m
      ? {
          value: ipca12m!.toDecimalPlaces(6).toString(),
          from: isoDate(ipcaMonths[ipcaMonths.length - 1].date),
          to: isoDate(ipcaMonths[0].date),
          source: ipcaMonths[0].source,
        }
      : null

    return {
      reading: {
        selic: freshSelic?.value ?? null,
        cdi: freshCdi?.value ?? null,
        ipca12m,
        selicSixMonthsAgo: pastSelic?.value ?? null,
        asOf: freshSelic?.date ?? freshCdi?.date ?? null,
        ipcaAsOf: hasIpca12m ? ipcaMonths[0].date : null,
      },
      sources,
    }
  }
}

function isFresh(
  value: IndicatorValue | null | undefined,
  now: Date,
  maxAgeDays: number
): value is IndicatorValue {
  return !!value && daysBetween(value.date, now) <= maxAgeDays
}

/** `months` vem do mais novo para o mais antigo. */
function areConsecutiveMonths(months: IndicatorValue[]) {
  const index = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth()

  return months.every(
    (month, position) =>
      position === 0 ||
      index(months[position - 1].date) - index(month.date) === 1
  )
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function describe(value: IndicatorValue | null) {
  return value
    ? {
        value: value.value.toString(),
        date: isoDate(value.date),
        source: value.source,
      }
    : null
}
