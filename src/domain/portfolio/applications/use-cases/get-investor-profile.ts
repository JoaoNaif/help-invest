import { Either, left, right } from '@/core/either'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { InvestorProfile } from '../../entities/investor-profile'
import { InvestorProfilesRepository } from '../repositories/investor-profiles-repository'

interface GetInvestorProfileUseCaseRequest {
  userId: string
}

type GetInvestorProfileUseCaseResponse = Either<
  ResourceNotFoundError,
  { profile: InvestorProfile; isOutdated: boolean }
>

/**
 * UC-07 — ver docs/08-casos-de-uso.md#uc-07--getinvestorprofile
 * `isOutdated` avisa o front para pedir revisão do perfil (> 6 meses).
 */
export class GetInvestorProfileUseCase {
  constructor(private investorProfilesRepository: InvestorProfilesRepository) {}

  async execute({
    userId,
  }: GetInvestorProfileUseCaseRequest): Promise<GetInvestorProfileUseCaseResponse> {
    const profile = await this.investorProfilesRepository.findByUserId(userId)

    // Perfil ainda não preenchido.
    if (!profile) {
      return left(new ResourceNotFoundError('Investor profile'))
    }

    return right({ profile, isOutdated: profile.isOutdated() })
  }
}
