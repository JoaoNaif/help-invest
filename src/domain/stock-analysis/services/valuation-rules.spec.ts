import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { ValuationRules, ValuationVerdict } from './valuation-rules'

const peers = [new Decimal('8'), new Decimal('10'), new Decimal('12')]

describe('Valuation Rules', () => {
  it('should mark a multiple well below the peer median as cheap', () => {
    const result = ValuationRules.compare(new Decimal('7'), peers)

    expect(result.verdict).toBe(ValuationVerdict.CHEAP)
    expect(result.peerMedian?.equals('10')).toBe(true)
    expect(result.diffPercent?.equals('-30')).toBe(true)
  })

  it('should mark a multiple well above the peer median as expensive', () => {
    const result = ValuationRules.compare(new Decimal('13'), peers)

    expect(result.verdict).toBe(ValuationVerdict.EXPENSIVE)
  })

  it('should mark a multiple inside the band as fair', () => {
    const result = ValuationRules.compare(new Decimal('11'), peers)

    expect(result.verdict).toBe(ValuationVerdict.FAIR)
  })

  it('should use the mean of the two middle values for an even count', () => {
    const result = ValuationRules.compare(new Decimal('10'), [
      new Decimal('8'),
      new Decimal('12'),
      new Decimal('9'),
      new Decimal('11'),
    ])

    expect(result.peerMedian?.equals('10')).toBe(true)
  })

  it('should be unavailable for a loss-making company (negative P/E)', () => {
    const result = ValuationRules.compare(new Decimal('-5'), peers)

    expect(result.verdict).toBe(ValuationVerdict.UNAVAILABLE)
    expect(result.diffPercent).toBeNull()
  })

  it('should ignore peers without a usable multiple', () => {
    const result = ValuationRules.compare(new Decimal('10'), [
      null,
      new Decimal('-3'),
      new Decimal('10'),
    ])

    expect(result.peerMedian?.equals('10')).toBe(true)
    expect(result.verdict).toBe(ValuationVerdict.FAIR)
  })

  it('should be unavailable when no peer is comparable', () => {
    const result = ValuationRules.compare(new Decimal('10'), [null])

    expect(result.verdict).toBe(ValuationVerdict.UNAVAILABLE)
    expect(result.peerMedian).toBeNull()
  })
})
