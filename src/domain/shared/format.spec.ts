import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { formatBRL, formatPercent } from './format'

describe('Format', () => {
  it('should format money in BRL', () => {
    expect(formatBRL(new Decimal('0'))).toBe('R$ 0,00')
    expect(formatBRL(new Decimal('999.9'))).toBe('R$ 999,90')
    expect(formatBRL(new Decimal('1234.567'))).toBe('R$ 1.234,57')
    expect(formatBRL(new Decimal('250000'))).toBe('R$ 250.000,00')
    expect(formatBRL(new Decimal('-1500'))).toBe('-R$ 1.500,00')
  })

  it('should format percentages', () => {
    expect(formatPercent(new Decimal('20'))).toBe('20,0%')
    expect(formatPercent(new Decimal('33.3333'))).toBe('33,3%')
    expect(formatPercent(new Decimal('12.345'), 2)).toBe('12,35%')
  })
})
