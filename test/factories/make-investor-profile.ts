import { faker } from '@faker-js/faker'
import Decimal from 'decimal.js'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import {
  InvestorProfile,
  InvestorProfileProps,
} from '@/domain/portfolio/entities/investor-profile'

export function makeInvestorProfile(
  override: Partial<InvestorProfileProps> = {},
  id?: UniqueEntityId
) {
  return InvestorProfile.create(
    {
      userId: new UniqueEntityId(),
      monthlyIncome: new Decimal(
        faker.finance.amount({ min: 2000, max: 30000 })
      ),
      emergencyReserve: new Decimal(
        faker.finance.amount({ min: 0, max: 100000 })
      ),
      goal: faker.helpers.objectValue(InvestmentGoal),
      horizonMonths: faker.number.int({ min: 6, max: 360 }),
      riskTolerance: faker.helpers.objectValue(RiskTolerance),
      ...override,
    },
    id
  )
}
