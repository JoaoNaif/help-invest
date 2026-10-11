import { Either, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import {
  MarketSnapshot,
  MarketSnapshotLoader,
} from '@/domain/market-data/applications/services/market-snapshot-loader'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { PortfolioStrategy } from '../../entities/enums/portfolio-strategy'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'
import {
  MarketReading,
  PortfolioAnalyzer,
} from '../../services/portfolio-analyzer'
import { PortfolioAnalysesRepository } from '../repositories/portfolio-analyses-repository'

interface CreatePortfolioAnalysisUseCaseRequest {
  userId: string
  strategy: PortfolioStrategy
}

/** Sempre `right`: dado de mercado ausente vira `null` + alerta, nunca erro. */
type CreatePortfolioAnalysisUseCaseResponse = Either<
  never,
  { analysis: PortfolioAnalysis }
>

/**
 * Compara a carteira atual com a faixa-alvo do perfil e da estratégia, olha o
 * cenário de juros e devolve os caminhos ranqueados. Números e regras vêm só
 * do código; o LLM não participa (a explicação é outro use-case). O perfil e
 * o mercado nunca bloqueiam: sem perfil vale o padrão, sem dado vira `null`.
 */
export class CreatePortfolioAnalysisUseCase {
  private marketSnapshotLoader: MarketSnapshotLoader

  constructor(
    private positionsRepository: PositionsRepository,
    private investorProfilesRepository: InvestorProfilesRepository,
    indicatorValuesRepository: IndicatorValuesRepository,
    private portfolioAnalysesRepository: PortfolioAnalysesRepository,
    private now: () => Date = () => new Date()
  ) {
    this.marketSnapshotLoader = new MarketSnapshotLoader(
      indicatorValuesRepository
    )
  }

  async execute({
    userId,
    strategy,
  }: CreatePortfolioAnalysisUseCaseRequest): Promise<CreatePortfolioAnalysisUseCaseResponse> {
    const now = this.now()

    const [positions, profile, market] = await Promise.all([
      this.positionsRepository.findManyByUserId(userId),
      this.investorProfilesRepository.findByUserId(userId),
      this.marketSnapshotLoader.load(now),
    ])

    const { report, assumptions } = PortfolioAnalyzer.analyze({
      positions,
      profile,
      strategy,
      market: toReading(market),
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
}

function toReading(market: MarketSnapshot): MarketReading {
  return {
    selic: market.selic?.value ?? null,
    cdi: market.cdi?.value ?? null,
    ipca12m: market.ipca12m,
    selicSixMonthsAgo: market.selicSixMonthsAgo?.value ?? null,
    asOf: market.selic?.date ?? market.cdi?.date ?? null,
    ipcaAsOf: market.ipcaMonths[0]?.date ?? null,
  }
}
