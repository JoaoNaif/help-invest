import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { IncomeTaxCalculator } from './income-tax-calculator'

describe('Income Tax Calculator', () => {
  describe('rate', () => {
    it.each([
      [1, '22.5'],
      [180, '22.5'],
      [181, '20'],
      [360, '20'],
      [361, '17.5'],
      [720, '17.5'],
      [721, '15'],
      [3650, '15'],
    ])('should apply the regressive bracket for %i days', (days, rate) => {
      expect(
        IncomeTaxCalculator.rateFor(AssetType.CDB, days).equals(rate)
      ).toBe(true)
    })

    it.each([AssetType.LCI, AssetType.LCA, AssetType.CRI, AssetType.CRA])(
      'should exempt %s for individuals',
      (assetType) => {
        expect(IncomeTaxCalculator.rateFor(assetType, 100).isZero()).toBe(true)
      }
    )

    it('should tax debentures (incentivized ones not modeled yet)', () => {
      expect(
        IncomeTaxCalculator.rateFor(AssetType.DEBENTURE, 800).equals('15')
      ).toBe(true)
    })
  })

  describe('net annual rate', () => {
    it('should equal gross × (1 − tax) for exactly one year', () => {
      // 365 dias, 17,5%: 16 × 0,825 = 13,2
      const net = IncomeTaxCalculator.netAnnualRate(
        new Decimal('16'),
        new Decimal('17.5'),
        365
      )

      expect(net.equals('13.2')).toBe(true)
    })

    it('should tax the gain of the whole period, not the annual rate', () => {
      // 2 anos a 16,39%: ganho 35,466321% → × 0,85 → 30,146373% → 14,0817% a.a.
      // (aplicar 15% direto na taxa anual daria 13,9315% — errado)
      const net = IncomeTaxCalculator.netAnnualRate(
        new Decimal('16.39'),
        new Decimal('15'),
        730
      )

      expect(net.toFixed(4)).toBe('14.0817')
    })

    it('should keep the gross rate when exempt', () => {
      const net = IncomeTaxCalculator.netAnnualRate(
        new Decimal('13.708'),
        new Decimal('0'),
        500
      )

      expect(net.equals('13.708')).toBe(true)
    })
  })
})
