import { ComparisonsRepository } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { Comparison } from '@/domain/comparison/entities/comparison'
import { ComparisonOption } from '@/domain/comparison/entities/comparison-option'

export class InMemoryComparisonsRepository implements ComparisonsRepository {
  public items: Comparison[] = []
  public options: ComparisonOption[] = []

  async create(comparison: Comparison, options: ComparisonOption[]) {
    this.items.push(comparison)
    this.options.push(...options)
  }
}
