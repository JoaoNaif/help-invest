import { faker } from '@faker-js/faker'
import Decimal from 'decimal.js'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'
import {
  IndicatorValue,
  IndicatorValueProps,
} from '@/domain/market-data/entities/indicator-value'

export function makeIndicatorValue(
  override: Partial<IndicatorValueProps> = {},
  id?: UniqueEntityId
) {
  return IndicatorValue.create(
    {
      indicator: Indicator.CDI,
      date: faker.date.recent(),
      value: new Decimal(
        faker.number.float({ min: 5, max: 15, fractionDigits: 2 })
      ),
      source: 'BCB SGS 4389',
      ...override,
    },
    id
  )
}
