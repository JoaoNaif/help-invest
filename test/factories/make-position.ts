import { faker } from '@faker-js/faker'
import Decimal from 'decimal.js'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Position, PositionProps } from '@/domain/portfolio/entities/position'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

export function makePosition(
  override: Partial<PositionProps> = {},
  id?: UniqueEntityId
) {
  return Position.create(
    {
      userId: new UniqueEntityId(),
      assetType: AssetType.CDB,
      name: `CDB ${faker.company.name()}`,
      issuerName: faker.company.name(),
      issuerCnpj: faker.string.numeric(14),
      investedAmount: new Decimal(
        faker.finance.amount({ min: 1000, max: 100000 })
      ),
      indexer: Indexer.CDI,
      rate: new Decimal(faker.number.int({ min: 90, max: 130 })),
      investedAt: faker.date.past(),
      maturityAt: faker.date.future({ years: 3 }),
      liquidity: Liquidity.AT_MATURITY,
      source: DataSource.MANUAL,
      ...override,
    },
    id
  )
}
