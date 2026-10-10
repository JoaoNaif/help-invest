import { Prisma, StockAnalysis as PrismaStockAnalysis } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  StockAnalysis,
  StockAnalysisAssumptions,
  StockAnalysisResult,
} from '@/domain/stock-analysis/entities/stock-analysis'

export class PrismaStockAnalysisMapper {
  static toDomain(raw: PrismaStockAnalysis): StockAnalysis {
    return StockAnalysis.create(
      {
        userId: new UniqueEntityId(raw.userId),
        tickers: raw.tickers,
        result: raw.result as unknown as StockAnalysisResult,
        assumptions: raw.assumptions as StockAnalysisAssumptions,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    analysis: StockAnalysis
  ): Prisma.StockAnalysisUncheckedCreateInput {
    return {
      id: analysis.id.toString(),
      userId: analysis.userId.toString(),
      tickers: analysis.tickers,
      result: analysis.result as unknown as Prisma.InputJsonObject,
      assumptions: analysis.assumptions as Prisma.InputJsonObject,
      createdAt: analysis.createdAt,
    }
  }
}
