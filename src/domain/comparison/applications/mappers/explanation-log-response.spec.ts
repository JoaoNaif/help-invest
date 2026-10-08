import { describe, expect, it } from 'vitest'
import { makeExplanation } from 'test/factories/make-explanation'
import {
  readExplanation,
  toExplanationLogResponse,
} from './explanation-log-response'

describe('Explanation Log Response', () => {
  it('should read back the explanation it wrote', () => {
    const explanation = makeExplanation({
      bestOptionId: 'a',
      bestReason: 'Combina com o objetivo.',
      options: [{ optionId: 'a', pros: ['Liquidez'], cons: ['Taxa menor'] }],
    })

    const response = toExplanationLogResponse(explanation, { id: 'msg_1' })

    expect(readExplanation(response)).toEqual(explanation)
  })

  it.each([
    [
      'empty summary',
      toExplanationLogResponse(makeExplanation({ summary: '  ' }), {}),
    ],
    ['null explanation', toExplanationLogResponse(null, {})],
    ['legacy plain text', { explanation: 'Texto corrido antigo', raw: {} }],
    [
      'malformed options',
      { explanation: { ...makeExplanation(), options: [{ optionId: 1 }] } },
    ],
    ['raw provider format', { content: [{ type: 'text', text: 'x' }] }],
    ['not an object', 'texto solto'],
    ['null', null],
  ])('should return null for %s', (_, response) => {
    expect(readExplanation(response)).toBeNull()
  })
})
