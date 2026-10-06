import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'

/** Salva a comparação e suas opções juntas (adapter Prisma: uma transação). */
export interface PaginationParams {
  /** Começa em 1. */
  page: number
  perPage: number
}

export abstract class ComparisonsRepository {
  abstract findById(id: string): Promise<Comparison | null>
  /** Comparações do usuário, mais recentes primeiro (sem as opções). */
  abstract findManyByUserId(
    userId: string,
    params: PaginationParams
  ): Promise<Comparison[]>
  abstract findOptionsByComparisonId(
    comparisonId: string
  ): Promise<ComparisonOption[]>
  abstract create(
    comparison: Comparison,
    options: ComparisonOption[]
  ): Promise<void>
  /**
   * `options` é a lista **completa** atual: o que não estiver nela é removido,
   * o que for novo é criado, o resto é atualizado.
   */
  abstract save(
    comparison: Comparison,
    options: ComparisonOption[]
  ): Promise<void>
}
