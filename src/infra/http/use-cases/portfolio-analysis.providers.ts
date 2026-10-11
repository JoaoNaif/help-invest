import { Provider } from '@nestjs/common'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { PortfolioAnalysesRepository } from '@/domain/portfolio-analysis/applications/repositories/portfolio-analyses-repository'
import { CreatePortfolioAnalysisUseCase } from '@/domain/portfolio-analysis/applications/use-cases/create-portfolio-analysis'
import { ExplainPortfolioAnalysisUseCase } from '@/domain/portfolio-analysis/applications/use-cases/explain-portfolio-analysis'
import { GetPortfolioAnalysisUseCase } from '@/domain/portfolio-analysis/applications/use-cases/get-portfolio-analysis'
import { ListPortfolioAnalysesUseCase } from '@/domain/portfolio-analysis/applications/use-cases/list-portfolio-analyses'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'

export const portfolioAnalysisUseCases: Provider[] = [
  {
    provide: CreatePortfolioAnalysisUseCase,
    inject: [
      PositionsRepository,
      InvestorProfilesRepository,
      IndicatorValuesRepository,
      PortfolioAnalysesRepository,
    ],
    useFactory: (
      positions: PositionsRepository,
      profiles: InvestorProfilesRepository,
      indicators: IndicatorValuesRepository,
      analyses: PortfolioAnalysesRepository
    ) =>
      new CreatePortfolioAnalysisUseCase(
        positions,
        profiles,
        indicators,
        analyses
      ),
  },
  {
    provide: GetPortfolioAnalysisUseCase,
    inject: [PortfolioAnalysesRepository, LlmLogsRepository],
    useFactory: (
      analyses: PortfolioAnalysesRepository,
      llmLogs: LlmLogsRepository
    ) => new GetPortfolioAnalysisUseCase(analyses, llmLogs),
  },
  {
    provide: ListPortfolioAnalysesUseCase,
    inject: [PortfolioAnalysesRepository],
    useFactory: (analyses: PortfolioAnalysesRepository) =>
      new ListPortfolioAnalysesUseCase(analyses),
  },
  {
    provide: ExplainPortfolioAnalysisUseCase,
    inject: [PortfolioAnalysesRepository, LlmGateway, LlmLogsRepository],
    useFactory: (
      analyses: PortfolioAnalysesRepository,
      llm: LlmGateway,
      llmLogs: LlmLogsRepository
    ) => new ExplainPortfolioAnalysisUseCase(analyses, llm, llmLogs),
  },
]
