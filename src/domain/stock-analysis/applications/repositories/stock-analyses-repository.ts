import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { StockAnalysis } from '../../entities/stock-analysis'

export abstract class StockAnalysesRepository {
  abstract findById(id: string): Promise<StockAnalysis | null>
  /** Análises do usuário, mais recentes primeiro. */
  abstract findManyByUserId(
    userId: string,
    params: PaginationParams
  ): Promise<StockAnalysis[]>
  abstract create(analysis: StockAnalysis): Promise<void>
}
