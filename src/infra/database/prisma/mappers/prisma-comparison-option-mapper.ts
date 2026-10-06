import Decimal from 'decimal.js'
import {
  Prisma,
  ComparisonOption as PrismaComparisonOption,
} from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { ComparisonOption } from '@/domain/comparison/entities/comparison-option'
import { Alert } from '@/domain/shared/alert'

export class PrismaComparisonOptionMapper {
  static toDomain(raw: PrismaComparisonOption): ComparisonOption {
    return ComparisonOption.create(
      {
        comparisonId: new UniqueEntityId(raw.comparisonId),
        assetType: raw.assetType,
        issuerName: raw.issuerName,
        issuerCnpj: raw.issuerCnpj,
        indexer: raw.indexer,
        rate: new Decimal(raw.rate.toString()),
        maturityAt: raw.maturityAt,
        liquidity: raw.liquidity,
        graceDays: raw.graceDays,
        minAmount: raw.minAmount ? new Decimal(raw.minAmount.toString()) : null,
        netAnnualRate: raw.netAnnualRate
          ? new Decimal(raw.netAnnualRate.toString())
          : null,
        alerts: (raw.alerts as unknown as Alert[] | null) ?? [],
        rawInput: raw.rawInput,
        source: raw.source,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    option: ComparisonOption
  ): Prisma.ComparisonOptionUncheckedCreateInput {
    return {
      id: option.id.toString(),
      comparisonId: option.comparisonId.toString(),
      assetType: option.assetType,
      issuerName: option.issuerName,
      issuerCnpj: option.issuerCnpj,
      indexer: option.indexer,
      rate: option.rate.toString(),
      maturityAt: option.maturityAt,
      liquidity: option.liquidity,
      graceDays: option.graceDays,
      minAmount: option.minAmount?.toString() ?? null,
      netAnnualRate: option.netAnnualRate?.toString() ?? null,
      alerts: option.alerts as unknown as Prisma.InputJsonArray,
      rawInput: option.rawInput,
      source: option.source,
      createdAt: option.createdAt,
    }
  }
}
