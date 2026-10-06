import Decimal from 'decimal.js'
import { Prisma, Comparison as PrismaComparison } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  Comparison,
  ComparisonAssumptions,
} from '@/domain/comparison/entities/comparison'

export class PrismaComparisonMapper {
  static toDomain(raw: PrismaComparison): Comparison {
    return Comparison.create(
      {
        userId: new UniqueEntityId(raw.userId),
        amount: new Decimal(raw.amount.toString()),
        horizonMonths: raw.horizonMonths,
        status: raw.status,
        assumptions: raw.assumptions as ComparisonAssumptions | null,
        chosenOptionId: raw.chosenOptionId
          ? new UniqueEntityId(raw.chosenOptionId)
          : null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    comparison: Comparison
  ): Prisma.ComparisonUncheckedCreateInput {
    return {
      id: comparison.id.toString(),
      userId: comparison.userId.toString(),
      amount: comparison.amount.toString(),
      horizonMonths: comparison.horizonMonths,
      status: comparison.status,
      assumptions: comparison.assumptions
        ? (comparison.assumptions as Prisma.InputJsonObject)
        : Prisma.DbNull,
      chosenOptionId: comparison.chosenOptionId?.toString() ?? null,
      createdAt: comparison.createdAt,
      updatedAt: comparison.updatedAt,
    }
  }
}
