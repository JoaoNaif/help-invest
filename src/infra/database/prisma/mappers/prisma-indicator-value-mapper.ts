import Decimal from 'decimal.js'
import { Prisma, IndicatorValue as PrismaIndicatorValue } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { IndicatorValue } from '@/domain/market-data/entities/indicator-value'

export class PrismaIndicatorValueMapper {
  static toDomain(raw: PrismaIndicatorValue): IndicatorValue {
    return IndicatorValue.create(
      {
        indicator: raw.indicator,
        date: raw.date,
        value: new Decimal(raw.value.toString()),
        source: raw.source,
        fetchedAt: raw.fetchedAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    value: IndicatorValue
  ): Prisma.IndicatorValueUncheckedCreateInput {
    return {
      id: value.id.toString(),
      indicator: value.indicator,
      date: value.date,
      value: value.value.toString(),
      source: value.source,
      fetchedAt: value.fetchedAt,
    }
  }
}
