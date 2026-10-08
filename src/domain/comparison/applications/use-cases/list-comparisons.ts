import { Either, right } from '@/core/either'
import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

/** Itens por página do histórico. */
export const COMPARISONS_PER_PAGE = 20

interface ListComparisonsUseCaseRequest {
  userId: string
  /** Começa em 1. Padrão: 1. */
  page?: number
}

/** Uma linha do histórico: a comparação e um resumo das suas opções. */
export interface ComparisonSummary {
  comparison: Comparison
  optionsCount: number
  /** Melhor taxa líquida; `null` enquanto a comparação não foi avaliada. */
  topOption: ComparisonOption | null
}

type ListComparisonsUseCaseResponse = Either<
  never,
  { comparisons: ComparisonSummary[] }
>

/**
 * UC-20 — ver docs/08-casos-de-uso.md#uc-20--listcomparisons
 * Histórico, mais recentes primeiro. Traz só o resumo das opções (quantas e
 * a melhor); o detalhe é o UC-19. Paginado: ao contrário da carteira, o
 * histórico só cresce.
 */
export class ListComparisonsUseCase {
  constructor(private comparisonsRepository: ComparisonsRepository) {}

  async execute({
    userId,
    page = 1,
  }: ListComparisonsUseCaseRequest): Promise<ListComparisonsUseCaseResponse> {
    const comparisons = await this.comparisonsRepository.findManyByUserId(
      userId,
      { page, perPage: COMPARISONS_PER_PAGE }
    )

    const options = await this.comparisonsRepository.findOptionsByComparisonIds(
      comparisons.map((comparison) => comparison.id.toString())
    )

    return right({
      comparisons: comparisons.map((comparison) =>
        summarize(
          comparison,
          options.filter((option) => option.comparisonId.equals(comparison.id))
        )
      ),
    })
  }
}

function summarize(
  comparison: Comparison,
  options: ComparisonOption[]
): ComparisonSummary {
  const topOption = options
    .filter((option) => option.netAnnualRate !== null)
    .reduce<ComparisonOption | null>(
      (best, option) =>
        !best || option.netAnnualRate!.gt(best.netAnnualRate!) ? option : best,
      null
    )

  return { comparison, optionsCount: options.length, topOption }
}
