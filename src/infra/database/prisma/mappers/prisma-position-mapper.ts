import Decimal from 'decimal.js'
import { Prisma, Position as PrismaPosition } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Position } from '@/domain/portfolio/entities/position'

export class PrismaPositionMapper {
  static toDomain(raw: PrismaPosition): Position {
    return Position.create(
      {
        userId: new UniqueEntityId(raw.userId),
        assetType: raw.assetType,
        name: raw.name,
        issuerName: raw.issuerName,
        issuerCnpj: raw.issuerCnpj,
        investedAmount: new Decimal(raw.investedAmount.toString()),
        indexer: raw.indexer,
        rate: raw.rate ? new Decimal(raw.rate.toString()) : null,
        investedAt: raw.investedAt,
        maturityAt: raw.maturityAt,
        liquidity: raw.liquidity,
        source: raw.source,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(position: Position): Prisma.PositionUncheckedCreateInput {
    return {
      id: position.id.toString(),
      userId: position.userId.toString(),
      assetType: position.assetType,
      name: position.name,
      issuerName: position.issuerName,
      issuerCnpj: position.issuerCnpj,
      investedAmount: position.investedAmount.toString(),
      indexer: position.indexer,
      rate: position.rate?.toString() ?? null,
      investedAt: position.investedAt,
      maturityAt: position.maturityAt,
      liquidity: position.liquidity,
      source: position.source,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    }
  }
}
