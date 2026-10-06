import { Comparison } from '../../entities/comparison'
import { ComparisonOption } from '../../entities/comparison-option'

/** Salva a comparação e suas opções juntas (adapter Prisma: uma transação). */
export abstract class ComparisonsRepository {
  abstract create(
    comparison: Comparison,
    options: ComparisonOption[]
  ): Promise<void>
}
