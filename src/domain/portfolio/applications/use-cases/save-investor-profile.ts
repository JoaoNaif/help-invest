import Decimal from 'decimal.js'
import { Either, right } from '@/core/either'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { InvestmentGoal } from '../../entities/enums/investment-goal'
import { RiskTolerance } from '../../entities/enums/risk-tolerance'
import { InvestorProfile } from '../../entities/investor-profile'
import { InvestorProfilesRepository } from '../repositories/investor-profiles-repository'

interface SaveInvestorProfileUseCaseRequest {
  userId: string
  monthlyIncome: Decimal
  emergencyReserve: Decimal
  goal: InvestmentGoal
  horizonMonths: number
  riskTolerance: RiskTolerance
}

type SaveInvestorProfileUseCaseResponse = Either<
  never,
  { profile: InvestorProfile }
>

/**
 * UC-06 — ver docs/08-casos-de-uso.md#uc-06--saveinvestorprofile
 * Cria o perfil na primeira vez; depois, atualiza (um por usuário).
 * Validação de formato (valores >= 0, horizonte > 0) fica no Zod do controller.
 */
export class SaveInvestorProfileUseCase {
  constructor(private investorProfilesRepository: InvestorProfilesRepository) {}

  async execute({
    userId,
    monthlyIncome,
    emergencyReserve,
    goal,
    horizonMonths,
    riskTolerance,
  }: SaveInvestorProfileUseCaseRequest): Promise<SaveInvestorProfileUseCaseResponse> {
    const existingProfile =
      await this.investorProfilesRepository.findByUserId(userId)

    if (!existingProfile) {
      const profile = InvestorProfile.create({
        userId: new UniqueEntityId(userId),
        monthlyIncome,
        emergencyReserve,
        goal,
        horizonMonths,
        riskTolerance,
      })

      await this.investorProfilesRepository.create(profile)

      return right({ profile })
    }

    existingProfile.monthlyIncome = monthlyIncome
    existingProfile.emergencyReserve = emergencyReserve
    existingProfile.goal = goal
    existingProfile.horizonMonths = horizonMonths
    existingProfile.riskTolerance = riskTolerance

    await this.investorProfilesRepository.save(existingProfile)

    return right({ profile: existingProfile })
  }
}
