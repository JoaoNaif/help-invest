import { InvestorProfile } from '@/domain/portfolio/entities/investor-profile'

export class InvestorProfilePresenter {
  static toHTTP(profile: InvestorProfile) {
    return {
      id: profile.id.toString(),
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
