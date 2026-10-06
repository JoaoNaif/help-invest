import { describe, expect, it } from 'vitest'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { makeComparison } from 'test/factories/make-comparison'
import { ComparisonStatus } from './enums/comparison-status'

describe('Comparison', () => {
  it('should start as draft', () => {
    const sut = makeComparison()

    expect(sut.status).toBe(ComparisonStatus.DRAFT)
    expect(sut.canConfirm).toBe(true)
    expect(sut.canComplete).toBe(false)
  })

  it('should go from draft to confirmed to done', () => {
    const sut = makeComparison()

    sut.confirm()
    expect(sut.status).toBe(ComparisonStatus.CONFIRMED)
    expect(sut.canConfirm).toBe(false)
    expect(sut.canComplete).toBe(true)

    sut.complete({ cdi: '10.40', source: 'BCB SGS 4389' })
    expect(sut.status).toBe(ComparisonStatus.DONE)
    expect(sut.assumptions).toEqual({ cdi: '10.40', source: 'BCB SGS 4389' })
    expect(sut.canComplete).toBe(false)
  })

  it('should be able to register the chosen option', () => {
    const sut = makeComparison()
    const optionId = new UniqueEntityId()

    sut.chooseOption(optionId)

    expect(sut.chosenOptionId?.equals(optionId)).toBe(true)
  })
})
