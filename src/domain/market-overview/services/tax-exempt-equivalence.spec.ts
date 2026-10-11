import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXEMPT_PERCENT_OF_CDI,
  TaxExemptEquivalence,
} from './tax-exempt-equivalence'

describe('Tax Exempt Equivalence', () => {
  it('should compute the equivalent taxed % of CDI for every bracket', () => {
    const result = TaxExemptEquivalence.compute(new Decimal(90))

    expect(result.kind).toBe('TAX_EXEMPT_VS_TAXED')
    expect(result.exemptPercentOfCdi).toBe('90.00')
    expect(result.brackets).toEqual([
      {
        label: 'até 180 dias',
        incomeTaxRate: '22.50',
        equivalentTaxedPercentOfCdi: '116.13',
      },
      {
        label: '181 a 360 dias',
        incomeTaxRate: '20.00',
        equivalentTaxedPercentOfCdi: '112.50',
      },
      {
        label: '361 a 720 dias',
        incomeTaxRate: '17.50',
        equivalentTaxedPercentOfCdi: '109.09',
      },
      {
        label: 'acima de 720 dias',
        incomeTaxRate: '15.00',
        equivalentTaxedPercentOfCdi: '105.88',
      },
    ])
  })

  it('should follow the exempt percentage given', () => {
    const result = TaxExemptEquivalence.compute(new Decimal('100'))

    expect(result.exemptPercentOfCdi).toBe('100.00')
    // 100 / (1 − 0,15)
    expect(result.brackets[3].equivalentTaxedPercentOfCdi).toBe('117.65')
  })

  it('should use 90% of CDI as the default', () => {
    expect(DEFAULT_EXEMPT_PERCENT_OF_CDI.toString()).toBe('90')
  })

  it('should explain what the number means', () => {
    expect(TaxExemptEquivalence.compute(new Decimal(90)).note).toContain(
      'LCA/LCI'
    )
  })
})
