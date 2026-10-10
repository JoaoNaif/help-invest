import { Either, right } from '@/core/either'
import { StockAnalysis } from '../../entities/stock-analysis'
import { StockAnalysesRepository } from '../repositories/stock-analyses-repository'

/** Itens por página do histórico. */
export const STOCK_ANALYSES_PER_PAGE = 20

interface ListStockAnalysesUseCaseRequest {
  userId: string
  /** Começa em 1. Padrão: 1. */
  page?: number
}

type ListStockAnalysesUseCaseResponse = Either<
  never,
  { analyses: StockAnalysis[] }
>

/** Histórico de análises do usuário, mais recentes primeiro, paginado. */
export class ListStockAnalysesUseCase {
  constructor(private stockAnalysesRepository: StockAnalysesRepository) {}

  async execute({
    userId,
    page = 1,
  }: ListStockAnalysesUseCaseRequest): Promise<ListStockAnalysesUseCaseResponse> {
    const analyses = await this.stockAnalysesRepository.findManyByUserId(
      userId,
      { page, perPage: STOCK_ANALYSES_PER_PAGE }
    )

    return right({ analyses })
  }
}
