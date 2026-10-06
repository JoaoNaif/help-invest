import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InvestmentGoal } from '../../entities/enums/investment-goal'
import { RiskTolerance } from '../../entities/enums/risk-tolerance'
import { SaveInvestorProfileUseCase } from './save-investor-profile'

let inMemoryInvestorProfilesRepository: InMemoryInvestorProfilesRepository
let sut: SaveInvestorProfileUseCase

describe('Save Investor Profile', () => {
  const userId = new UniqueEntityId()

  const input = {
    userId: userId.toString(),
    monthlyIncome: new Decimal('8500.00'),
    emergencyReserve: new Decimal('30000.00'),
    goal: InvestmentGoal.RETIREMENT,
    horizonMonths: 240,
    riskTolerance: RiskTolerance.MEDIUM,
  }

  beforeEach(() => {
    inMemoryInvestorProfilesRepository =
      new InMemoryInvestorProfilesRepository()
    sut = new SaveInvestorProfileUseCase(inMemoryInvestorProfilesRepository)
  })

  it('should be able to create the profile on first save', async () => {
    const result = await sut.execute(input)

    expect(result.isRight()).toBe(true)
    expect(inMemoryInvestorProfilesRepository.items).toHaveLength(1)

    const profile = inMemoryInvestorProfilesRepository.items[0]
    expect(profile.userId.equals(userId)).toBe(true)
    expect(profile.monthlyIncome.equals('8500')).toBe(true)
    expect(profile.emergencyReserve.equals('30000')).toBe(true)
    expect(profile.goal).toBe(InvestmentGoal.RETIREMENT)
    expect(profile.horizonMonths).toBe(240)
    expect(profile.riskTolerance).toBe(RiskTolerance.MEDIUM)
  })

  it('should update the existing profile instead of creating another', async () => {
    const existing = makeInvestorProfile({
      userId,
      updatedAt: new Date('2026-01-01'),
    })
    await inMemoryInvestorProfilesRepository.create(existing)

    const result = await sut.execute({
      ...input,
      goal: InvestmentGoal.PURCHASE,
      horizonMonths: 24,
    })

    expect(result.isRight()).toBe(true)
    expect(inMemoryInvestorProfilesRepository.items).toHaveLength(1)

    const profile = inMemoryInvestorProfilesRepository.items[0]
    expect(profile.id.equals(existing.id)).toBe(true)
    expect(profile.goal).toBe(InvestmentGoal.PURCHASE)
    expect(profile.horizonMonths).toBe(24)
    expect(profile.monthlyIncome.equals('8500')).toBe(true)
    expect(profile.isOutdated()).toBe(false)
  })

  it('should not touch the profile of another user', async () => {
    const otherProfile = makeInvestorProfile({ horizonMonths: 12 })
    await inMemoryInvestorProfilesRepository.create(otherProfile)

    await sut.execute(input)

    expect(inMemoryInvestorProfilesRepository.items).toHaveLength(2)
    expect(otherProfile.horizonMonths).toBe(12)
  })
})
