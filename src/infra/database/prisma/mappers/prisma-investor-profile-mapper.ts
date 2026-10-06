import Decimal from 'decimal.js'
import {
  Prisma,
  InvestorProfile as PrismaInvestorProfile,
} from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'

export class PrismaInvestorProfileMapper {
  static toDomain(raw: PrismaInvestorProfile): InvestorProfile {
    return InvestorProfile.create(
      {
        userId: new UniqueEntityId(raw.userId),
        monthlyIncome: new Decimal(raw.monthlyIncome.toString()),
        emergencyReserve: new Decimal(raw.emergencyReserve.toString()),
        goal: raw.goal,
        horizonMonths: raw.horizonMonths,
        riskTolerance: raw.riskTolerance,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(
    profile: InvestorProfile
  ): Prisma.InvestorProfileUncheckedCreateInput {
    return {
      id: profile.id.toString(),
      userId: profile.userId.toString(),
      monthlyIncome: profile.monthlyIncome.toString(),
      emergencyReserve: profile.emergencyReserve.toString(),
      goal: profile.goal,
      horizonMonths: profile.horizonMonths,
      riskTolerance: profile.riskTolerance,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }
  }
}
