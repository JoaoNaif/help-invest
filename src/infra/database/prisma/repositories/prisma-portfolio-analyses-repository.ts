import { Injectable } from '@nestjs/common'
import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { PortfolioAnalysesRepository } from '@/domain/portfolio-analysis/applications/repositories/portfolio-analyses-repository'
import { PortfolioAnalysis } from '@/domain/portfolio-analysis/entities/portfolio-analysis'
import { PrismaPortfolioAnalysisMapper } from '../mappers/prisma-portfolio-analysis-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaPortfolioAnalysesRepository implements PortfolioAnalysesRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<PortfolioAnalysis | null> {
    const analysis = await this.prisma.portfolioAnalysis.findUnique({
      where: { id },
    })

    return analysis ? PrismaPortfolioAnalysisMapper.toDomain(analysis) : null
  }

  async findManyByUserId(
    userId: string,
    { page, perPage }: PaginationParams
  ): Promise<PortfolioAnalysis[]> {
    const analyses = await this.prisma.portfolioAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: perPage,
      skip: (page - 1) * perPage,
    })

    return analyses.map(PrismaPortfolioAnalysisMapper.toDomain)
  }

  async create(analysis: PortfolioAnalysis): Promise<void> {
    await this.prisma.portfolioAnalysis.create({
      data: PrismaPortfolioAnalysisMapper.toPrisma(analysis),
    })
  }
}
