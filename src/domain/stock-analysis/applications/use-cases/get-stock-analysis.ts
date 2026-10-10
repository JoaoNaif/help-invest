import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { StockAnalysis } from '../../entities/stock-analysis'
import { StockAnalysesRepository } from '../repositories/stock-analyses-repository'

interface GetStockAnalysisUseCaseRequest {
  userId: string
  stockAnalysisId: string
}

type GetStockAnalysisUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  { analysis: StockAnalysis }
>

/** Uma análise do usuário; de outro usuário é `NotAllowedError`. */
export class GetStockAnalysisUseCase {
  constructor(private stockAnalysesRepository: StockAnalysesRepository) {}

  async execute({
    userId,
    stockAnalysisId,
  }: GetStockAnalysisUseCaseRequest): Promise<GetStockAnalysisUseCaseResponse> {
    const analysis =
      await this.stockAnalysesRepository.findById(stockAnalysisId)

    if (!analysis) {
      return left(new ResourceNotFoundError('StockAnalysis'))
    }

    if (analysis.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    return right({ analysis })
  }
}
