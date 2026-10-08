import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { ComparisonExplanation } from '../dtos/comparison-explanation'
import {
  ComparisonExplanationInput,
  ExplanationOption,
} from '../dtos/comparison-explanation-input'
import { ExplanationFailedError } from '../errors/explanation-failed-error'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { LlmUnavailableError } from '../errors/llm-unavailable-error'
import { LlmGateway } from '../gateways/llm-gateway'
import { toExplanationLogResponse } from '../mappers/explanation-log-response'
import { sanitizeExplanation } from '../mappers/sanitize-explanation'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

interface ExplainComparisonUseCaseRequest {
  userId: string
  comparisonId: string
}

type ExplainComparisonUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidComparisonStatusError
  | LlmUnavailableError
  | ExplanationFailedError,
  { explanation: ComparisonExplanation }
>

/**
 * UC-17 — ver docs/08-casos-de-uso.md#uc-17--explaincomparison
 * O LLM redige a explicação **a partir do que o motor já calculou** — não
 * calcula nada. A explicação não ganha coluna: fica no LlmLog da comparação.
 */
export class ExplainComparisonUseCase {
  constructor(
    private comparisonsRepository: ComparisonsRepository,
    private investorProfilesRepository: InvestorProfilesRepository,
    private llmGateway: LlmGateway,
    private llmLogsRepository: LlmLogsRepository
  ) {}

  async execute({
    userId,
    comparisonId,
  }: ExplainComparisonUseCaseRequest): Promise<ExplainComparisonUseCaseResponse> {
    const comparison = await this.comparisonsRepository.findById(comparisonId)

    if (!comparison) {
      return left(new ResourceNotFoundError('Comparison'))
    }

    if (comparison.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    if (comparison.status !== ComparisonStatus.DONE) {
      return left(
        new InvalidComparisonStatusError(
          comparison.status,
          ComparisonStatus.DONE
        )
      )
    }

    const [options, profile] = await Promise.all([
      this.comparisonsRepository.findOptionsByComparisonId(comparisonId),
      this.investorProfilesRepository.findByUserId(userId),
    ])

    const input: ComparisonExplanationInput = {
      amount: comparison.amount.toString(),
      horizonMonths: comparison.horizonMonths,
      options: rank(options),
      assumptions: comparison.assumptions ?? {},
      // O objetivo da comparação pesa mais que o do perfil.
      goal: comparison.goal ?? profile?.goal ?? null,
      investor: profile
        ? {
            goal: profile.goal,
            riskTolerance: profile.riskTolerance,
            horizonMonths: profile.horizonMonths,
          }
        : null,
    }

    const result = await this.llmGateway.explainComparison(input)

    if (result.isLeft()) {
      return left(result.value)
    }

    const { call } = result.value

    // O LLM pode devolver id inventado: só vale o que existe nesta comparação.
    const explanation = result.value.explanation
      ? sanitizeExplanation(
          result.value.explanation,
          options.map((option) => option.id.toString())
        )
      : null

    await this.llmLogsRepository.create(
      LlmLog.create({
        userId: comparison.userId,
        purpose: LlmPurpose.EXPLANATION,
        model: call.model,
        prompt: call.prompt,
        response: toExplanationLogResponse(explanation, call.rawResponse),
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        comparisonId: comparison.id,
      })
    )

    if (!explanation) {
      return left(new ExplanationFailedError())
    }

    return right({ explanation })
  }
}

function rank(options: ComparisonOption[]): ExplanationOption[] {
  return [...options]
    .sort((a, b) => b.netAnnualRate!.comparedTo(a.netAnnualRate!))
    .map((option, index) => ({
      optionId: option.id.toString(),
      rank: index + 1,
      assetType: option.assetType,
      issuerName: option.issuerName,
      indexer: option.indexer,
      rate: option.rate.toString(),
      maturityAt: option.maturityAt?.toISOString().slice(0, 10) ?? null,
      liquidity: option.liquidity,
      graceDays: option.graceDays,
      netAnnualRate: option.netAnnualRate!.toString(),
      alerts: option.alerts,
    }))
}
