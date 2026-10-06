import { describe, expect, it } from 'vitest'
import {
  readExplanation,
  toExplanationLogResponse,
} from './explanation-log-response'

describe('Explanation Log Response', () => {
  it('should read back the explanation it wrote', () => {
    const response = toExplanationLogResponse('Texto', { id: 'msg_1' })

    expect(readExplanation(response)).toBe('Texto')
  })

  it.each([
    ['empty text', toExplanationLogResponse('  ', {})],
    ['null text', toExplanationLogResponse(null, {})],
    ['raw provider format', { content: [{ type: 'text', text: 'x' }] }],
    ['not an object', 'texto solto'],
    ['null', null],
  ])('should return null for %s', (_, response) => {
    expect(readExplanation(response)).toBeNull()
  })
})
