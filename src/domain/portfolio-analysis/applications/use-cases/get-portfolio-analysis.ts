import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'
import { PortfolioExplanation } from '../dtos/portfolio-explanation'
import { readPortfolioExplanation } from '../mappers/portfolio-explanation-log-response'
import { PortfolioAnalysesRepository } from '../repositories/portfolio-analyses-repository'

interface GetPortfolioAnalysisUseCaseRequest {
  userId: string
  portfolioAnalysisId: string
}

type GetPortfolioAnalysisUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    analysis: PortfolioAnalysis
    /** Última explicação válida gerada, se houver. */
    explanation: PortfolioExplanation | null
  }
>

/** Uma análise do usuário; de outro usuário é `NotAllowedError`. */
export class GetPortfolioAnalysisUseCase {
  constructor(
    private portfolioAnalysesRepository: PortfolioAnalysesRepository,
    private llmLogsRepository: LlmLogsRepository
  ) {}

  async execute({
    userId,
    portfolioAnalysisId,
  }: GetPortfolioAnalysisUseCaseRequest): Promise<GetPortfolioAnalysisUseCaseResponse> {
    const analysis =
      await this.portfolioAnalysesRepository.findById(portfolioAnalysisId)

    if (!analysis) {
      return left(new ResourceNotFoundError('PortfolioAnalysis'))
    }

    if (analysis.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    const logs = await this.llmLogsRepository.findManyByPortfolioAnalysisId(
      portfolioAnalysisId,
      LlmPurpose.PORTFOLIO_EXPLANATION
    )

    return right({
      analysis,
      // Pula tentativas que falharam (resposta vazia).
      explanation:
        logs
          .map((log) => readPortfolioExplanation(log.response))
          .find((text) => text !== null) ?? null,
    })
  }
}
