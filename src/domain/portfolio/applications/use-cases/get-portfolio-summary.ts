import { Either, right } from '@/core/either'
import {
  PortfolioRules,
  PortfolioSummary,
} from '../../services/portfolio-rules'
import { InvestorProfilesRepository } from '../repositories/investor-profiles-repository'
import { PositionsRepository } from '../repositories/positions-repository'

interface GetPortfolioSummaryUseCaseRequest {
  userId: string
}

type GetPortfolioSummaryUseCaseResponse = Either<never, PortfolioSummary>

/**
 * UC-12 — ver docs/08-casos-de-uso.md#uc-12--getportfoliosummary
 * Só orquestra: todo o cálculo fica em PortfolioRules.
 */
export class GetPortfolioSummaryUseCase {
  constructor(
    private positionsRepository: PositionsRepository,
    private investorProfilesRepository: InvestorProfilesRepository
  ) {}

  async execute({
    userId,
  }: GetPortfolioSummaryUseCaseRequest): Promise<GetPortfolioSummaryUseCaseResponse> {
    const [positions, profile] = await Promise.all([
      this.positionsRepository.findManyByUserId(userId),
      this.investorProfilesRepository.findByUserId(userId),
    ])

    return right(PortfolioRules.summarize(positions, profile))
  }
}
