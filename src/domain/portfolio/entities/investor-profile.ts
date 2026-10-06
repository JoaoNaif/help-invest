import Decimal from 'decimal.js'
import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { InvestmentGoal } from './enums/investment-goal'
import { RiskTolerance } from './enums/risk-tolerance'

export interface InvestorProfileProps {
  userId: UniqueEntityId
  monthlyIncome: Decimal
  emergencyReserve: Decimal
  goal: InvestmentGoal
  horizonMonths: number
  riskTolerance: RiskTolerance
  createdAt: Date
  updatedAt: Date
}

/** Meses sem atualizar até o sistema pedir revisão do perfil. */
export const PROFILE_MAX_AGE_MONTHS = 6

/** O momento do investidor. Um por usuário. */
export class InvestorProfile extends Entity<InvestorProfileProps> {
  get userId() {
    return this.props.userId
  }

  get monthlyIncome() {
    return this.props.monthlyIncome
  }

  set monthlyIncome(monthlyIncome: Decimal) {
    this.props.monthlyIncome = monthlyIncome
    this.touch()
  }

  get emergencyReserve() {
    return this.props.emergencyReserve
  }

  set emergencyReserve(emergencyReserve: Decimal) {
    this.props.emergencyReserve = emergencyReserve
    this.touch()
  }

  get goal() {
    return this.props.goal
  }

  set goal(goal: InvestmentGoal) {
    this.props.goal = goal
    this.touch()
  }

  get horizonMonths() {
    return this.props.horizonMonths
  }

  set horizonMonths(horizonMonths: number) {
    this.props.horizonMonths = horizonMonths
    this.touch()
  }

  get riskTolerance() {
    return this.props.riskTolerance
  }

  set riskTolerance(riskTolerance: RiskTolerance) {
    this.props.riskTolerance = riskTolerance
    this.touch()
  }

  get createdAt() {
    return this.props.createdAt
  }

  get updatedAt() {
    return this.props.updatedAt
  }

  isOutdated(now = new Date(), maxAgeMonths = PROFILE_MAX_AGE_MONTHS) {
    const limit = new Date(this.props.updatedAt)
    limit.setMonth(limit.getMonth() + maxAgeMonths)

    return now.getTime() >= limit.getTime()
  }

  private touch() {
    this.props.updatedAt = new Date()
  }

  static create(
    props: Optional<InvestorProfileProps, 'createdAt' | 'updatedAt'>,
    id?: UniqueEntityId
  ) {
    const now = new Date()

    return new InvestorProfile(
      {
        ...props,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now,
      },
      id
    )
  }
}
