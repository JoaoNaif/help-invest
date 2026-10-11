import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { ExplanationFailedError } from '@/domain/comparison/applications/errors/explanation-failed-error'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'
import { PortfolioExplanation } from '../dtos/portfolio-explanation'
import { PortfolioExplanationInput } from '../dtos/portfolio-explanation-input'
import { toPortfolioExplanationLogResponse } from '../mappers/portfolio-explanation-log-response'
import { sanitizePortfolioExplanation } from '../mappers/sanitize-portfolio-explanation'
import { PortfolioAnalysesRepository } from '../repositories/portfolio-analyses-repository'

interface ExplainPortfolioAnalysisUseCaseRequest {
  userId: string
  portfolioAnalysisId: string
}

type ExplainPortfolioAnalysisUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | LlmUnavailableError
  | ExplanationFailedError,
  { explanation: PortfolioExplanation }
>

/**
 * O LLM redige a explicação **a partir do que o motor já calculou** — não
 * recalcula nada. Toda resposta é registrada no `LlmLog`, inclusive a vazia.
 */
export class ExplainPortfolioAnalysisUseCase {
  constructor(
    private portfolioAnalysesRepository: PortfolioAnalysesRepository,
    private llmGateway: LlmGateway,
    private llmLogsRepository: LlmLogsRepository
  ) {}

  async execute({
    userId,
    portfolioAnalysisId,
  }: ExplainPortfolioAnalysisUseCaseRequest): Promise<ExplainPortfolioAnalysisUseCaseResponse> {
    const analysis =
      await this.portfolioAnalysesRepository.findById(portfolioAnalysisId)

    if (!analysis) {
      return left(new ResourceNotFoundError('PortfolioAnalysis'))
    }

    if (analysis.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    const result = await this.llmGateway.explainPortfolio(toInput(analysis))

    if (result.isLeft()) {
      return left(result.value)
    }

    const { call } = result.value

    // O LLM pode devolver classe inventada ou lista longa: o domínio confere.
    const explanation = result.value.explanation
      ? sanitizePortfolioExplanation(result.value.explanation)
      : null

    await this.llmLogsRepository.create(
      LlmLog.create({
        userId: analysis.userId,
        purpose: LlmPurpose.PORTFOLIO_EXPLANATION,
        model: call.model,
        prompt: call.prompt,
        response: toPortfolioExplanationLogResponse(
          explanation,
          call.rawResponse
        ),
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        portfolioAnalysisId: analysis.id,
      })
    )

    if (!explanation) {
      return left(new ExplanationFailedError())
    }

    return right({ explanation })
  }
}

/** Só percentuais e códigos: valores em reais, reserva e emissor ficam de fora. */
function toInput(analysis: PortfolioAnalysis): PortfolioExplanationInput {
  const { result } = analysis

  return {
    strategy: analysis.strategy,
    investor: {
      riskTolerance: result.profileUsed.riskTolerance,
      horizonMonths: result.profileUsed.horizonMonths,
      goal: result.profileUsed.goal,
      isDefault: result.profileUsed.isDefault,
    },
    current: result.current.map(({ assetClass, percentage }) => ({
      assetClass,
      percentage,
    })),
    target: result.target,
    paths: result.paths,
    market: result.market,
    reserveIsBelowRecommended: result.reserve
      ? result.reserve.isBelowRecommended
      : null,
    alerts: result.alerts.map(({ code, severity }) => ({ code, severity })),
  }
}
