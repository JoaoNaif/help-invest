import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { AlertSeverity } from '@/domain/shared/enums/alert-severity'

describe('Comparison Option', () => {
  const alert = {
    code: 'ABOVE_FGC_LIMIT',
    severity: AlertSeverity.WARNING,
    message: 'Valor acima do limite do FGC para este emissor.',
  }

  it('should start without evaluation', () => {
    const sut = makeComparisonOption()

    expect(sut.isEvaluated).toBe(false)
    expect(sut.netAnnualRate).toBeNull()
    expect(sut.alerts).toEqual([])
  })

  it('should store the rules engine result', () => {
    const sut = makeComparisonOption()

    sut.applyEvaluation(new Decimal('0.0912'), [alert])

    expect(sut.isEvaluated).toBe(true)
    expect(sut.netAnnualRate?.equals('0.0912')).toBe(true)
    expect(sut.alerts).toEqual([alert])
  })

  it('should discard the evaluation when an input changes', () => {
    const sut = makeComparisonOption()
    sut.applyEvaluation(new Decimal('0.0912'), [alert])

    sut.rate = new Decimal('115')

    expect(sut.isEvaluated).toBe(false)
    expect(sut.alerts).toEqual([])
  })
})
