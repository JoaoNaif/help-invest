import { describe, expect, it } from 'vitest'
import { PortfolioExplanation } from '../dtos/portfolio-explanation'
import {
  readPortfolioExplanation,
  toPortfolioExplanationLogResponse,
} from './portfolio-explanation-log-response'
import { sanitizePortfolioExplanation } from './sanitize-portfolio-explanation'

const explanation: PortfolioExplanation = {
  summary: '  A carteira está concentrada.  ',
  highlights: [
    { assetClass: 'FIXED_POST', text: ' Acima da faixa. ' },
    { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
  ],
  attentionPoints: ['Reserva baixa.', '  ', 'Concentração no emissor.'],
}

describe('Sanitize Portfolio Explanation', () => {
  it('should trim texts and drop empty points', () => {
    const result = sanitizePortfolioExplanation(explanation)

    expect(result).toEqual({
      summary: 'A carteira está concentrada.',
      highlights: [
        { assetClass: 'FIXED_POST', text: 'Acima da faixa.' },
        { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
      ],
      attentionPoints: ['Reserva baixa.', 'Concentração no emissor.'],
    })
  })

  it('should drop an asset class the LLM made up', () => {
    const result = sanitizePortfolioExplanation({
      ...explanation,
      highlights: [
        { assetClass: 'PETR4' as never, text: 'Compre PETR4' },
        { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
      ],
    })

    expect(result?.highlights).toEqual([
      { assetClass: 'STOCKS', text: 'Abaixo da faixa.' },
    ])
  })

  it('should drop a repeated class and empty highlight text', () => {
    const result = sanitizePortfolioExplanation({
      ...explanation,
      highlights: [
        { assetClass: 'STOCKS', text: 'Primeiro.' },
        { assetClass: 'STOCKS', text: 'Repetido.' },
        { assetClass: 'CRYPTO', text: '   ' },
      ],
    })

    expect(result?.highlights).toEqual([
      { assetClass: 'STOCKS', text: 'Primeiro.' },
    ])
  })

  it('should keep at most 3 items per list', () => {
    const result = sanitizePortfolioExplanation({
      summary: 'Resumo.',
      highlights: [
        { assetClass: 'FIXED_POST', text: 'a' },
        { assetClass: 'FIXED_INFLATION', text: 'b' },
        { assetClass: 'FIXED_PRE', text: 'c' },
        { assetClass: 'STOCKS', text: 'd' },
      ],
      attentionPoints: ['1', '2', '3', '4'],
    })

    expect(result?.highlights).toHaveLength(3)
    expect(result?.attentionPoints).toEqual(['1', '2', '3'])
  })

  it('should refuse an explanation without a summary', () => {
    expect(
      sanitizePortfolioExplanation({ ...explanation, summary: '   ' })
    ).toBeNull()
  })
})

describe('Portfolio Explanation Log Response', () => {
  it('should read back a saved explanation', () => {
    const response = toPortfolioExplanationLogResponse(
      { summary: 'Resumo.', highlights: [], attentionPoints: [] },
      { raw: true }
    )

    expect(readPortfolioExplanation(response)?.summary).toBe('Resumo.')
  })

  it.each([
    ['null', null],
    ['text', 'texto'],
    ['without explanation', { raw: {} }],
    ['null explanation', { explanation: null, raw: {} }],
    [
      'unknown asset class',
      {
        explanation: {
          summary: 'x',
          highlights: [{ assetClass: 'PETR4', text: 'y' }],
          attentionPoints: [],
        },
      },
    ],
  ])('should return null for %s', (_, response) => {
    expect(readPortfolioExplanation(response)).toBeNull()
  })
})
