import { Injectable } from '@nestjs/common'
import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { StockAnalysesRepository } from '@/domain/stock-analysis/applications/repositories/stock-analyses-repository'
import { StockAnalysis } from '@/domain/stock-analysis/entities/stock-analysis'
import { PrismaStockAnalysisMapper } from '../mappers/prisma-stock-analysis-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaStockAnalysesRepository implements StockAnalysesRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<StockAnalysis | null> {
    const analysis = await this.prisma.stockAnalysis.findUnique({
      where: { id },
    })

    return analysis ? PrismaStockAnalysisMapper.toDomain(analysis) : null
  }

  async findManyByUserId(
    userId: string,
    { page, perPage }: PaginationParams
  ): Promise<StockAnalysis[]> {
    const analyses = await this.prisma.stockAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: perPage,
      skip: (page - 1) * perPage,
    })

    return analyses.map(PrismaStockAnalysisMapper.toDomain)
  }

  async create(analysis: StockAnalysis): Promise<void> {
    await this.prisma.stockAnalysis.create({
      data: PrismaStockAnalysisMapper.toPrisma(analysis),
    })
  }
}
