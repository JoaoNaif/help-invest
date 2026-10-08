import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { ComparisonExplanation } from '../dtos/comparison-explanation'
import { readExplanation } from '../mappers/explanation-log-response'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

interface GetComparisonUseCaseRequest {
  userId: string
  comparisonId: string
}

type GetComparisonUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    comparison: Comparison
    /** Avaliada (DONE): da maior para a menor taxa líquida. */
    options: ComparisonOption[]
    /** Última explicação válida gerada (UC-17), se houver. */
    explanation: ComparisonExplanation | null
  }
>

/** UC-19 — ver docs/08-casos-de-uso.md#uc-19--getcomparison */
export class GetComparisonUseCase {
  constructor(
    private comparisonsRepository: ComparisonsRepository,
    private llmLogsRepository: LlmLogsRepository
  ) {}

  async execute({
    userId,
    comparisonId,
  }: GetComparisonUseCaseRequest): Promise<GetComparisonUseCaseResponse> {
    const comparison = await this.comparisonsRepository.findById(comparisonId)

    if (!comparison) {
      return left(new ResourceNotFoundError('Comparison'))
    }

    if (comparison.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    const [options, explanationLogs] = await Promise.all([
      this.comparisonsRepository.findOptionsByComparisonId(comparisonId),
      this.llmLogsRepository.findManyByComparisonId(
        comparisonId,
        LlmPurpose.EXPLANATION
      ),
    ])

    const isEvaluated = comparison.status === ComparisonStatus.DONE

    return right({
      comparison,
      options: isEvaluated
        ? [...options].sort((a, b) =>
            b.netAnnualRate!.comparedTo(a.netAnnualRate!)
          )
        : options,
      // Pula tentativas que falharam (resposta vazia).
      explanation:
        explanationLogs
          .map((log) => readExplanation(log.response))
          .find((text) => text !== null) ?? null,
    })
  }
}
