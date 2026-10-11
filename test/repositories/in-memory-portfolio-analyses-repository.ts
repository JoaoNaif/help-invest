import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { PortfolioAnalysesRepository } from '@/domain/portfolio-analysis/applications/repositories/portfolio-analyses-repository'
import { PortfolioAnalysis } from '@/domain/portfolio-analysis/entities/portfolio-analysis'

export class InMemoryPortfolioAnalysesRepository implements PortfolioAnalysesRepository {
  public items: PortfolioAnalysis[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id.toString() === id) ?? null
  }

  async findManyByUserId(userId: string, { page, perPage }: PaginationParams) {
    return this.items
      .filter((item) => item.userId.toString() === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice((page - 1) * perPage, page * perPage)
  }

  async create(analysis: PortfolioAnalysis) {
    this.items.push(analysis)
  }
}
