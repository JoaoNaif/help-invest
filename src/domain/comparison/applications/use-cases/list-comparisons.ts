import { Either, right } from '@/core/either'
import { Comparison } from '../../entities/comparison'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

/** Itens por página do histórico. */
export const COMPARISONS_PER_PAGE = 20

interface ListComparisonsUseCaseRequest {
  userId: string
  /** Começa em 1. Padrão: 1. */
  page?: number
}

type ListComparisonsUseCaseResponse = Either<
  never,
  { comparisons: Comparison[] }
>

/**
 * UC-20 — ver docs/08-casos-de-uso.md#uc-20--listcomparisons
 * Histórico, mais recentes primeiro, sem as opções (o detalhe é o UC-19).
 * Paginado: ao contrário da carteira, o histórico só cresce.
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

    return right({ comparisons })
  }
}
