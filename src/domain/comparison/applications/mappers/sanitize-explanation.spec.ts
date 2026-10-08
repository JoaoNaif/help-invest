import { describe, expect, it } from 'vitest'
import { makeExplanation } from 'test/factories/make-explanation'
import {
  MAX_POINTS_PER_OPTION,
  sanitizeExplanation,
} from './sanitize-explanation'

const ids = ['a', 'b']

describe('Sanitize Explanation', () => {
  it('should keep a valid explanation as it is', () => {
    const explanation = makeExplanation({
      bestOptionId: 'a',
      bestReason: 'Combina com o objetivo.',
      options: [
        { optionId: 'a', pros: ['Liquidez'], cons: ['Taxa menor'] },
        { optionId: 'b', pros: ['Taxa maior'], cons: ['Dinheiro preso'] },
      ],
    })

    expect(sanitizeExplanation(explanation, ids)).toEqual(explanation)
  })

  it('should drop the indication and its reason when the id does not exist', () => {
    const result = sanitizeExplanation(
      makeExplanation({ bestOptionId: 'inventado', bestReason: 'Motivo.' }),
      ids
    )

    expect(result?.bestOptionId).toBeNull()
    expect(result?.bestReason).toBeNull()
  })

  it('should drop unknown and repeated options', () => {
    const result = sanitizeExplanation(
      makeExplanation({
        options: [
          { optionId: 'a', pros: ['1'], cons: [] },
          { optionId: 'a', pros: ['repetida'], cons: [] },
          { optionId: 'x', pros: ['inventada'], cons: [] },
        ],
      }),
      ids
    )

    expect(result?.options).toEqual([{ optionId: 'a', pros: ['1'], cons: [] }])
  })

  it('should trim the points, drop empty ones and cap the list', () => {
    const result = sanitizeExplanation(
      makeExplanation({
        options: [
          {
            optionId: 'a',
            pros: ['  um  ', '', '   ', 'dois', 'três', 'quatro', 'cinco'],
            cons: [],
          },
        ],
      }),
      ids
    )

    expect(result?.options[0].pros).toEqual(['um', 'dois', 'três'])
    expect(result?.options[0].pros).toHaveLength(MAX_POINTS_PER_OPTION)
  })

  it('should refuse an explanation without a summary', () => {
    expect(
      sanitizeExplanation(makeExplanation({ summary: '  ' }), ids)
    ).toBeNull()
  })
})
