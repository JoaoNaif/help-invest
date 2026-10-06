import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { Comparison } from '../../entities/comparison'
import { ComparisonStatus } from '../../entities/enums/comparison-status'
import { InvalidComparisonStatusError } from '../errors/invalid-comparison-status-error'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

interface ChooseComparisonOptionUseCaseRequest {
  userId: string
  comparisonId: string
  optionId: string
}

type ChooseComparisonOptionUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError | InvalidComparisonStatusError,
  { comparison: Comparison }
>

/**
 * UC-18 — ver docs/08-casos-de-uso.md#uc-18--choosecomparisonoption
 * Registra o que o usuário decidiu (base para comparar com o resultado real
 * no futuro). Pode trocar a escolha: a nova substitui a anterior.
 */
export class ChooseComparisonOptionUseCase {
  constructor(private comparisonsRepository: ComparisonsRepository) {}

  async execute({
    userId,
    comparisonId,
    optionId,
  }: ChooseComparisonOptionUseCaseRequest): Promise<ChooseComparisonOptionUseCaseResponse> {
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

    const options =
      await this.comparisonsRepository.findOptionsByComparisonId(comparisonId)

    const option = options.find((item) => item.id.toString() === optionId)

    // Opção inexistente ou de outra comparação.
    if (!option) {
      return left(new ResourceNotFoundError('Comparison option'))
    }

    comparison.chooseOption(option.id)

    await this.comparisonsRepository.save(comparison, options)

    return right({ comparison })
  }
}
