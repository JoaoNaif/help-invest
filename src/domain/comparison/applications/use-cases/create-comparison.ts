import Decimal from 'decimal.js'
import { Either, left, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonOptionInput } from '../dtos/comparison-option-input'
import { ExtractionFailedError } from '../errors/extraction-failed-error'
import { LlmUnavailableError } from '../errors/llm-unavailable-error'
import { NoOptionsFoundError } from '../errors/no-options-found-error'
import { ExtractionSource, LlmCall, LlmGateway } from '../gateways/llm-gateway'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

export type ComparisonInput =
  { type: 'manual'; options: ComparisonOptionInput[] } | ExtractionSource

interface CreateComparisonUseCaseRequest {
  userId: string
  amount: Decimal
  horizonMonths: number
  /** Para que serve este dinheiro (opcional). */
  goal?: InvestmentGoal | null
  input: ComparisonInput
}

type CreateComparisonUseCaseResponse = Either<
  LlmUnavailableError | ExtractionFailedError | NoOptionsFoundError,
  { comparison: Comparison; options: ComparisonOption[] }
>

/**
 * UC-14 — ver docs/08-casos-de-uso.md#uc-14--createcomparison
 * Nasce como DRAFT para o usuário conferir. O LLM só extrai; toda chamada
 * ao LLM é registrada no LlmLog, inclusive as que falham na validação.
 */
export class CreateComparisonUseCase {
  constructor(
    private comparisonsRepository: ComparisonsRepository,
    private llmGateway: LlmGateway,
    private llmLogsRepository: LlmLogsRepository
  ) {}

  async execute({
    userId,
    amount,
    horizonMonths,
    goal,
    input,
  }: CreateComparisonUseCaseRequest): Promise<CreateComparisonUseCaseResponse> {
    const userUniqueId = new UniqueEntityId(userId)

    let optionInputs: ComparisonOptionInput[]
    let source: DataSource
    let llmCall: LlmCall | null = null

    if (input.type === 'manual') {
      optionInputs = input.options
      source = DataSource.MANUAL
    } else {
      const extraction = await this.llmGateway.extractOptions(input)

      if (extraction.isLeft()) {
        return left(extraction.value)
      }

      llmCall = extraction.value.call

      if (extraction.value.options === null) {
        await this.registerLlmCall(userUniqueId, llmCall, null)

        return left(new ExtractionFailedError())
      }

      optionInputs = extraction.value.options
      source = DataSource.LLM_EXTRACTED
    }

    if (optionInputs.length === 0) {
      if (llmCall) {
        await this.registerLlmCall(userUniqueId, llmCall, null)
      }

      return left(new NoOptionsFoundError())
    }

    const comparison = Comparison.create({
      userId: userUniqueId,
      amount,
      horizonMonths,
      goal,
    })

    const options = optionInputs.map((optionInput) =>
      ComparisonOption.create({
        ...optionInput,
        comparisonId: comparison.id,
        source,
      })
    )

    await this.comparisonsRepository.create(comparison, options)

    // Depois de salvar a comparação: o log aponta para ela (FK).
    if (llmCall) {
      await this.registerLlmCall(userUniqueId, llmCall, comparison.id)
    }

    return right({ comparison, options })
  }

  private async registerLlmCall(
    userId: UniqueEntityId,
    call: LlmCall,
    comparisonId: UniqueEntityId | null
  ) {
    await this.llmLogsRepository.create(
      LlmLog.create({
        userId,
        purpose: LlmPurpose.EXTRACTION,
        model: call.model,
        prompt: call.prompt,
        response: call.rawResponse,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        comparisonId,
      })
    )
  }
}
