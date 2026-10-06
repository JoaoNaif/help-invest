import { faker } from '@faker-js/faker'
import Decimal from 'decimal.js'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  Comparison,
  ComparisonProps,
} from '@/domain/comparison/entities/comparison'

export function makeComparison(
  override: Partial<ComparisonProps> = {},
  id?: UniqueEntityId
) {
  return Comparison.create(
    {
      userId: new UniqueEntityId(),
      amount: new Decimal(faker.finance.amount({ min: 1000, max: 100000 })),
      horizonMonths: faker.number.int({ min: 6, max: 60 }),
      ...override,
    },
    id
  )
}
