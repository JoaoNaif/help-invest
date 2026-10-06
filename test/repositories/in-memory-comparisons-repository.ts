import { ComparisonsRepository } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { Comparison } from '@/domain/comparison/entities/comparison'
import { ComparisonOption } from '@/domain/comparison/entities/comparison-option'

export class InMemoryComparisonsRepository implements ComparisonsRepository {
  public items: Comparison[] = []
  public options: ComparisonOption[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id.toString() === id) ?? null
  }

  async findOptionsByComparisonId(comparisonId: string) {
    return this.options.filter(
      (option) => option.comparisonId.toString() === comparisonId
    )
  }

  async create(comparison: Comparison, options: ComparisonOption[]) {
    this.items.push(comparison)
    this.options.push(...options)
  }

  async save(comparison: Comparison, options: ComparisonOption[]) {
    const index = this.items.findIndex((item) => item.id.equals(comparison.id))
    this.items[index] = comparison

    this.options = [
      ...this.options.filter(
        (option) => !option.comparisonId.equals(comparison.id)
      ),
      ...options,
    ]
  }
}
