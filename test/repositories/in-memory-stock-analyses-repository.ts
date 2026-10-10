import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { StockAnalysesRepository } from '@/domain/stock-analysis/applications/repositories/stock-analyses-repository'
import { StockAnalysis } from '@/domain/stock-analysis/entities/stock-analysis'

export class InMemoryStockAnalysesRepository implements StockAnalysesRepository {
  public items: StockAnalysis[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id.toString() === id) ?? null
  }

  async findManyByUserId(userId: string, { page, perPage }: PaginationParams) {
    return this.items
      .filter((item) => item.userId.toString() === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice((page - 1) * perPage, page * perPage)
  }

  async create(analysis: StockAnalysis) {
    this.items.push(analysis)
  }
}
