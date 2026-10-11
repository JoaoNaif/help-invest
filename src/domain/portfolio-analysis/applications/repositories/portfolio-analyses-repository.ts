import { PaginationParams } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'

export abstract class PortfolioAnalysesRepository {
  abstract findById(id: string): Promise<PortfolioAnalysis | null>
  /** Análises do usuário, mais recentes primeiro. */
  abstract findManyByUserId(
    userId: string,
    params: PaginationParams
  ): Promise<PortfolioAnalysis[]>
  abstract create(analysis: PortfolioAnalysis): Promise<void>
}
