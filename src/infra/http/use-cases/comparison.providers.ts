import { Provider } from '@nestjs/common'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { ComparisonsRepository } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { ChooseComparisonOptionUseCase } from '@/domain/comparison/applications/use-cases/choose-comparison-option'
import { CreateComparisonUseCase } from '@/domain/comparison/applications/use-cases/create-comparison'
import { EvaluateComparisonUseCase } from '@/domain/comparison/applications/use-cases/evaluate-comparison'
import { ExplainComparisonUseCase } from '@/domain/comparison/applications/use-cases/explain-comparison'
import { GetComparisonUseCase } from '@/domain/comparison/applications/use-cases/get-comparison'
import { ListRecentComparisonOptionsUseCase } from '@/domain/comparison/applications/use-cases/list-recent-comparison-options'
import { ListComparisonsUseCase } from '@/domain/comparison/applications/use-cases/list-comparisons'
import { ReviewComparisonOptionsUseCase } from '@/domain/comparison/applications/use-cases/review-comparison-options'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'

export const comparisonUseCases: Provider[] = [
  {
    provide: CreateComparisonUseCase,
    inject: [ComparisonsRepository, LlmGateway, LlmLogsRepository],
    useFactory: (
      comparisons: ComparisonsRepository,
      llm: LlmGateway,
      llmLogs: LlmLogsRepository
    ) => new CreateComparisonUseCase(comparisons, llm, llmLogs),
  },
  {
    provide: ReviewComparisonOptionsUseCase,
    inject: [ComparisonsRepository],
    useFactory: (comparisons: ComparisonsRepository) =>
      new ReviewComparisonOptionsUseCase(comparisons),
  },
  {
    provide: EvaluateComparisonUseCase,
    inject: [
      ComparisonsRepository,
      IndicatorValuesRepository,
      PositionsRepository,
      InvestorProfilesRepository,
    ],
    useFactory: (
      comparisons: ComparisonsRepository,
      indicators: IndicatorValuesRepository,
      positions: PositionsRepository,
      profiles: InvestorProfilesRepository
    ) =>
      new EvaluateComparisonUseCase(
        comparisons,
        indicators,
        positions,
        profiles
      ),
  },
  {
    provide: ExplainComparisonUseCase,
    inject: [
      ComparisonsRepository,
      InvestorProfilesRepository,
      LlmGateway,
      LlmLogsRepository,
    ],
    useFactory: (
      comparisons: ComparisonsRepository,
      profiles: InvestorProfilesRepository,
      llm: LlmGateway,
      llmLogs: LlmLogsRepository
    ) => new ExplainComparisonUseCase(comparisons, profiles, llm, llmLogs),
  },
  {
    provide: ChooseComparisonOptionUseCase,
    inject: [ComparisonsRepository],
    useFactory: (comparisons: ComparisonsRepository) =>
      new ChooseComparisonOptionUseCase(comparisons),
  },
  {
    provide: GetComparisonUseCase,
    inject: [ComparisonsRepository, LlmLogsRepository],
    useFactory: (
      comparisons: ComparisonsRepository,
      llmLogs: LlmLogsRepository
    ) => new GetComparisonUseCase(comparisons, llmLogs),
  },
  {
    provide: ListComparisonsUseCase,
    inject: [ComparisonsRepository],
    useFactory: (comparisons: ComparisonsRepository) =>
      new ListComparisonsUseCase(comparisons),
  },
  {
    provide: ListRecentComparisonOptionsUseCase,
    inject: [ComparisonsRepository],
    useFactory: (comparisons: ComparisonsRepository) =>
      new ListRecentComparisonOptionsUseCase(comparisons),
  },
]
