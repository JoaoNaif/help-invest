import { Either, right } from '@/core/either'
import { PortfolioAnalysis } from '../../entities/portfolio-analysis'
import { PortfolioAnalysesRepository } from '../repositories/portfolio-analyses-repository'

/** Itens por página do histórico. */
export const PORTFOLIO_ANALYSES_PER_PAGE = 20

interface ListPortfolioAnalysesUseCaseRequest {
  userId: string
  /** Começa em 1. Padrão: 1. */
  page?: number
}

type ListPortfolioAnalysesUseCaseResponse = Either<
  never,
  { analyses: PortfolioAnalysis[] }
>

/** Histórico de análises do usuário, mais recentes primeiro, paginado. */
export class ListPortfolioAnalysesUseCase {
  constructor(
    private portfolioAnalysesRepository: PortfolioAnalysesRepository
  ) {}

  async execute({
    userId,
    page = 1,
  }: ListPortfolioAnalysesUseCaseRequest): Promise<ListPortfolioAnalysesUseCaseResponse> {
    const analyses = await this.portfolioAnalysesRepository.findManyByUserId(
      userId,
      { page, perPage: PORTFOLIO_ANALYSES_PER_PAGE }
    )

    return right({ analyses })
  }
}
