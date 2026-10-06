import { describe, expect, it } from 'vitest'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'

describe('Investor Profile', () => {
  it('should not be outdated before 6 months', () => {
    const sut = makeInvestorProfile({ updatedAt: new Date('2026-05-15') })

    expect(sut.isOutdated(new Date('2026-10-31'))).toBe(false)
  })

  it('should be outdated after 6 months without update', () => {
    const sut = makeInvestorProfile({ updatedAt: new Date('2026-04-01') })

    expect(sut.isOutdated(new Date('2026-10-06'))).toBe(true)
  })

  it('should stop being outdated when changed', () => {
    const sut = makeInvestorProfile({ updatedAt: new Date('2020-01-01') })

    sut.horizonMonths = 24

    expect(sut.isOutdated()).toBe(false)
  })
})
