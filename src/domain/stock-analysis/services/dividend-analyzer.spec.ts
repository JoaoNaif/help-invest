import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  DividendKind,
  DividendPayment,
} from '../applications/dtos/stock-snapshot'
import { DividendAnalyzer } from './dividend-analyzer'

const now = new Date('2026-10-09T00:00:00Z')
const price = new Decimal('25')

function dividend(exDate: string, amount: string): DividendPayment {
  return {
    exDate: new Date(`${exDate}T00:00:00Z`),
    paymentDate: null,
    amountPerShare: new Decimal(amount),
    kind: DividendKind.DIVIDEND,
  }
}

describe('Dividend Analyzer', () => {
  it('should compute trailing 12 months total and yield', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [
        dividend('2026-08-15', '0.80'),
        dividend('2026-02-15', '0.70'),
        dividend('2025-06-01', '9.00'), // fora dos 12 meses
      ],
      price,
      now,
      historyFrom: new Date('2020-01-01T00:00:00Z'),
    })

    expect(result.trailing12mPerShare.equals('1.5')).toBe(true)
    // 1,50 / 25 = 6%
    expect(result.trailing12mYield.equals('6')).toBe(true)
  })

  it('should average the covered 12-month windows and flag consistency', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [
        dividend('2026-03-01', '2'),
        dividend('2025-03-01', '2'),
        dividend('2024-03-01', '2'),
        dividend('2023-03-01', '2'),
        dividend('2022-03-01', '4'),
      ],
      price,
      now,
      historyFrom: new Date('2020-01-01T00:00:00Z'),
    })

    expect(result.yearsCovered).toBe(5)
    expect(result.yearsWithPayment).toBe(5)
    expect(result.consistent).toBe(true)
    // (2+2+2+2+4) / 5 = 2,4
    expect(result.averageAnnualPerShare?.equals('2.4')).toBe(true)
  })

  it('should not be consistent when a year had no payment', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [dividend('2026-03-01', '2'), dividend('2024-03-01', '2')],
      price,
      now,
      historyFrom: new Date('2020-01-01T00:00:00Z'),
    })

    expect(result.yearsWithPayment).toBe(2)
    expect(result.consistent).toBe(false)
  })

  it('should ignore windows older than the source history', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [dividend('2026-03-01', '3'), dividend('2025-03-01', '1')],
      price,
      now,
      historyFrom: new Date('2024-10-09T00:00:00Z'),
    })

    expect(result.yearsCovered).toBe(2)
    expect(result.consistent).toBe(true)
    // (3 + 1) / 2 = 2, e não (3 + 1) / 5
    expect(result.averageAnnualPerShare?.equals('2')).toBe(true)
  })

  it('should return null average when there is no history', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [],
      price,
      now,
      historyFrom: now,
    })

    expect(result.averageAnnualPerShare).toBeNull()
    expect(result.consistent).toBe(false)
    expect(result.trailing12mYield.equals(0)).toBe(true)
  })

  it('should return the nearest upcoming com date', () => {
    const result = DividendAnalyzer.analyze({
      dividends: [
        dividend('2026-12-20', '1'),
        dividend('2026-11-10', '0.5'),
        dividend('2026-08-01', '0.4'),
      ],
      price,
      now,
      historyFrom: new Date('2020-01-01T00:00:00Z'),
    })

    expect(result.upcoming?.amountPerShare.equals('0.5')).toBe(true)
    // proventos futuros não entram no acumulado de 12 meses
    expect(result.trailing12mPerShare.equals('0.4')).toBe(true)
  })
})
