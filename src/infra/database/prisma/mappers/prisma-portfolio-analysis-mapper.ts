import {
  Prisma,
  PortfolioAnalysis as PrismaPortfolioAnalysis,
} from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  PortfolioAnalysis,
  PortfolioAnalysisAssumptions,
  PortfolioAnalysisResult,
} from '@/domain/portfolio-analysis/entities/portfolio-analysis'

export class PrismaPortfolioAnalysisMapper {
  static toDomain(raw: PrismaPortfolioAnalysis): PortfolioAnalysis {
    return PortfolioAnalysis.create(
      {
        userId: new UniqueEntityId(raw.userId),
        strategy: raw.strategy,
        result: raw.result as unknown as PortfolioAnalysisResult,
        assumptions: raw.assumptions as PortfolioAnalysisAssumptions,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    analysis: PortfolioAnalysis
  ): Prisma.PortfolioAnalysisUncheckedCreateInput {
    return {
      id: analysis.id.toString(),
      userId: analysis.userId.toString(),
      strategy: analysis.strategy,
      result: analysis.result as unknown as Prisma.InputJsonObject,
      assumptions: analysis.assumptions as Prisma.InputJsonObject,
      createdAt: analysis.createdAt,
    }
  }
}
