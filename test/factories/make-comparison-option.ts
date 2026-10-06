import { faker } from '@faker-js/faker'
import Decimal from 'decimal.js'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  ComparisonOption,
  ComparisonOptionProps,
} from '@/domain/comparison/entities/comparison-option'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

export function makeComparisonOption(
  override: Partial<ComparisonOptionProps> = {},
  id?: UniqueEntityId
) {
  return ComparisonOption.create(
    {
      comparisonId: new UniqueEntityId(),
      assetType: AssetType.CDB,
      issuerName: faker.company.name(),
      issuerCnpj: faker.string.numeric(14),
      indexer: Indexer.CDI,
      rate: new Decimal(faker.number.int({ min: 90, max: 130 })),
      maturityAt: faker.date.future({ years: 3 }),
      liquidity: Liquidity.AT_MATURITY,
      source: DataSource.MANUAL,
      ...override,
    },
    id
  )
}
