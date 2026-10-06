import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { ComparisonOptionInput } from '../dtos/comparison-option-input'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { NoOptionsFoundError } from '../errors/no-options-found-error'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

/** Com `id` = edita · sem `id` = nova · ausente da lista = removida. */
export type ReviewedOptionInput = ComparisonOptionInput & { id?: string }

interface ReviewComparisonOptionsUseCaseRequest {
  userId: string
  comparisonId: string
  /** Lista **completa** já corrigida pelo usuário. */
  options: ReviewedOptionInput[]
}

type ReviewComparisonOptionsUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidComparisonStatusError
  | NoOptionsFoundError,
  { comparison: Comparison; options: ComparisonOption[] }
>

/**
 * UC-15 — ver docs/08-casos-de-uso.md#uc-15--reviewcomparisonoptions
 * Só em DRAFT. Opção editada mantém o `source` original (o que o LLM errou
 * fica registrado no LlmLog); opção nova é sempre MANUAL.
 */
export class ReviewComparisonOptionsUseCase {
  constructor(private comparisonsRepository: ComparisonsRepository) {}

  async execute({
    userId,
    comparisonId,
    options: inputs,
  }: ReviewComparisonOptionsUseCaseRequest): Promise<ReviewComparisonOptionsUseCaseResponse> {
    const comparison = await this.comparisonsRepository.findById(comparisonId)

    if (!comparison) {
      return left(new ResourceNotFoundError('Comparison'))
    }

    if (comparison.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    if (comparison.status !== ComparisonStatus.DRAFT) {
      return left(
        new InvalidComparisonStatusError(
          comparison.status,
          ComparisonStatus.DRAFT
        )
      )
    }

    if (inputs.length === 0) {
      return left(new NoOptionsFoundError())
    }

    const current =
      await this.comparisonsRepository.findOptionsByComparisonId(comparisonId)

    const reviewed: ComparisonOption[] = []

    for (const { id, ...input } of inputs) {
      if (!id) {
        reviewed.push(
          ComparisonOption.create({
            ...input,
            comparisonId: comparison.id,
            source: DataSource.MANUAL,
          })
        )
        continue
      }

      const existing = current.find((option) => option.id.toString() === id)

      // Id que não pertence a esta comparação.
      if (!existing) {
        return left(new ResourceNotFoundError('Comparison option'))
      }

      applyInput(existing, input)
      reviewed.push(existing)
    }

    await this.comparisonsRepository.save(comparison, reviewed)

    return right({ comparison, options: reviewed })
  }
}

/** Substituição completa: opcional ausente vira `null`. */
function applyInput(option: ComparisonOption, input: ComparisonOptionInput) {
  option.assetType = input.assetType
  option.indexer = input.indexer
  option.rate = input.rate
  option.issuerName = input.issuerName ?? null
  option.issuerCnpj = input.issuerCnpj ?? null
  option.maturityAt = input.maturityAt ?? null
  option.liquidity = input.liquidity ?? null
  option.graceDays = input.graceDays ?? null
  option.minAmount = input.minAmount ?? null
}
