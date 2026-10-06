import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'

export class InMemoryIndicatorValuesRepository implements IndicatorValuesRepository {
  public items: IndicatorValue[] = []

  async findLatest(indicator: Indicator) {
    return (await this.findRecent(indicator, 1))[0] ?? null
  }

  async findRecent(indicator: Indicator, limit: number) {
    return this.items
      .filter((item) => item.indicator === indicator)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit)
  }

  async createMany(values: IndicatorValue[]) {
    let inserted = 0

    for (const value of values) {
      const exists = this.items.some(
        (item) =>
          item.indicator === value.indicator &&
          item.date.getTime() === value.date.getTime()
      )

      if (!exists) {
        this.items.push(value)
        inserted++
      }
    }

    return inserted
  }
}
