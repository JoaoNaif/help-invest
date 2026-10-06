import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { InMemoryInvestorProfilesRepository } from 'test/repositories/in-memory-investor-profiles-repository'
import { InMemoryPositionsRepository } from 'test/repositories/in-memory-positions-repository'
import { GetPortfolioSummaryUseCase } from './get-portfolio-summary'

let inMemoryPositionsRepository: InMemoryPositionsRepository
let inMemoryInvestorProfilesRepository: InMemoryInvestorProfilesRepository
let sut: GetPortfolioSummaryUseCase

describe('Get Portfolio Summary', () => {
  const userId = new UniqueEntityId()

  beforeEach(() => {
    inMemoryPositionsRepository = new InMemoryPositionsRepository()
    inMemoryInvestorProfilesRepository =
      new InMemoryInvestorProfilesRepository()
    sut = new GetPortfolioSummaryUseCase(
      inMemoryPositionsRepository,
      inMemoryInvestorProfilesRepository
    )
  })

  it('should summarize only the positions of the user', async () => {
    await inMemoryPositionsRepository.create(
      makePosition({ userId, investedAmount: new Decimal('30000') })
    )
    await inMemoryPositionsRepository.create(
      makePosition({ userId, investedAmount: new Decimal('20000') })
    )
    await inMemoryPositionsRepository.create(
      makePosition({ investedAmount: new Decimal('999999') })
    )

    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value.total.equals('50000')).toBe(true)
  })

  it('should cross the portfolio with the user profile', async () => {
    await inMemoryInvestorProfilesRepository.create(
      makeInvestorProfile({
        userId,
        monthlyIncome: new Decimal('10000'),
        emergencyReserve: new Decimal('5000'),
      })
    )
    await inMemoryPositionsRepository.create(
      makePosition({
        userId,
        assetType: AssetType.CDB,
        issuerCnpj: '11111111000111',
        investedAmount: new Decimal('300000'),
      })
    )

    const result = await sut.execute({ userId: userId.toString() })

    const codes = result.value.alerts.map((alert) => alert.code)
    expect(codes).toContain('ABOVE_FGC_LIMIT')
    expect(codes).toContain('LOW_EMERGENCY_RESERVE')
    expect(codes).not.toContain('PROFILE_MISSING')
  })

  it('should ask for the profile when the user has none', async () => {
    const result = await sut.execute({ userId: userId.toString() })

    expect(result.isRight()).toBe(true)
    expect(result.value.alerts.map((alert) => alert.code)).toEqual([
      'PROFILE_MISSING',
    ])
  })
})
