import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { IssuerExposure } from '@/domain/portfolio/services/portfolio-rules'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { makeComparisonOption } from 'test/factories/make-comparison-option'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { ComparisonOption } from '../entities/comparison-option'
import {
  ComparisonContext,
  ComparisonRules,
  OptionFigures,
} from './comparison-rules'

const now = new Date('2026-10-06T12:00:00Z')
const CNPJ = '11111111000111'

function exposure(overrides: Partial<IssuerExposure>): IssuerExposure {
  return {
    issuerCnpj: CNPJ,
    issuerName: 'Banco A',
    amount: new Decimal(0),
    percentage: new Decimal(0),
    fgcCoveredAmount: new Decimal(0),
    fgcUncoveredAmount: new Decimal(0),
    ...overrides,
  }
}

function context(
  overrides: Partial<ComparisonContext> = {}
): ComparisonContext {
  return {
    amount: new Decimal('10000'),
    now,
    horizonEnd: new Date('2028-10-06T00:00:00Z'),
    cdi: new Decimal('14.90'),
    profile: makeInvestorProfile({
      monthlyIncome: new Decimal('10000'),
      emergencyReserve: new Decimal('60000'),
    }),
    // Carteira grande e pulverizada: não dispara concentração por padrão.
    portfolio: { total: new Decimal('1000000'), byIssuer: [] },
    ...overrides,
  }
}

// Opção "limpa": CDB, liquidez diária, sem vencimento, CNPJ informado.
function cleanOption(
  overrides: Parameters<typeof makeComparisonOption>[0] = {}
) {
  return makeComparisonOption({
    assetType: AssetType.CDB,
    issuerCnpj: CNPJ,
    liquidity: Liquidity.DAILY,
    maturityAt: null,
    graceDays: null,
    minAmount: null,
    ...overrides,
  })
}

const figures: OptionFigures = {
  grossAnnualRate: new Decimal('15'),
  holdingDays: 730,
}

function codes(
  option: ComparisonOption,
  ctx: ComparisonContext = context(),
  fig: OptionFigures = figures
) {
  return ComparisonRules.alertsFor(option, fig, ctx).map((alert) => alert.code)
}

describe('Comparison Rules', () => {
  it('should not alert a clean option', () => {
    expect(codes(cleanOption())).toEqual([])
  })

  describe('FGC', () => {
    it('should alert when amount + what the user already has passes the limit', () => {
      const ctx = context({
        amount: new Decimal('60000'),
        portfolio: {
          total: new Decimal('1000000'),
          byIssuer: [
            exposure({
              amount: new Decimal('200000'),
              fgcCoveredAmount: new Decimal('200000'),
            }),
          ],
        },
      })

      const alerts = ComparisonRules.alertsFor(cleanOption(), figures, ctx)
      const alert = alerts.find((a) => a.code === 'ABOVE_FGC_LIMIT')

      expect(alert?.severity).toBe('DANGER')
      expect(alert?.message).toContain('R$ 10.000,00 sem garantia')
    })

    it('should not alert exactly at the limit', () => {
      const ctx = context({
        amount: new Decimal('50000'),
        portfolio: {
          total: new Decimal('1000000'),
          byIssuer: [exposure({ fgcCoveredAmount: new Decimal('200000') })],
        },
      })

      expect(codes(cleanOption(), ctx)).not.toContain('ABOVE_FGC_LIMIT')
    })

    it.each([AssetType.DEBENTURE, AssetType.CRI, AssetType.CRA])(
      'should warn that %s has no FGC',
      (assetType) => {
        expect(codes(cleanOption({ assetType }))).toContain('NO_FGC_COVERAGE')
      }
    )

    it('should not warn about FGC for Tesouro (government guaranteed)', () => {
      expect(codes(cleanOption({ assetType: AssetType.TESOURO }))).toEqual([])
    })

    it('should warn when the CNPJ is missing for a covered product', () => {
      expect(codes(cleanOption({ issuerCnpj: null }))).toEqual([
        'ISSUER_CNPJ_MISSING',
      ])
    })
  })

  describe('maturity and liquidity', () => {
    it('should alert when it matures after the user horizon', () => {
      const option = cleanOption({
        liquidity: Liquidity.AT_MATURITY,
        maturityAt: new Date('2030-01-01T00:00:00Z'),
      })

      expect(codes(option)).toContain('MATURITY_AFTER_HORIZON')
    })

    it('should not alert a late maturity with daily liquidity', () => {
      const option = cleanOption({
        liquidity: Liquidity.DAILY,
        maturityAt: new Date('2030-01-01T00:00:00Z'),
      })

      expect(codes(option)).not.toContain('MATURITY_AFTER_HORIZON')
    })

    it('should alert when the maturity date already passed', () => {
      const option = cleanOption({
        maturityAt: new Date('2026-01-01T00:00:00Z'),
      })

      expect(codes(option)).toContain('MATURITY_IN_PAST')
    })

    it('should alert a grace period ("daily" with grace)', () => {
      const alerts = ComparisonRules.alertsFor(
        cleanOption({ graceDays: 90 }),
        figures,
        context()
      )

      expect(alerts.find((a) => a.code === 'GRACE_PERIOD')?.message).toContain(
        '90 dias'
      )
    })

    it('should alert locked money when the emergency reserve is low', () => {
      const ctx = context({
        profile: makeInvestorProfile({
          monthlyIncome: new Decimal('10000'),
          emergencyReserve: new Decimal('5000'),
        }),
      })

      expect(
        codes(cleanOption({ liquidity: Liquidity.AT_MATURITY }), ctx)
      ).toContain('LOW_LIQUIDITY_NO_RESERVE')
      expect(codes(cleanOption({ liquidity: Liquidity.DAILY }), ctx)).toEqual(
        []
      )
    })

    it('should skip the reserve check without a profile', () => {
      const ctx = context({ profile: null })

      expect(
        codes(cleanOption({ liquidity: Liquidity.AT_MATURITY }), ctx)
      ).toEqual([])
    })
  })

  describe('rate', () => {
    it('should warn when the gross rate is above 130% of CDI', () => {
      // 130% × 14,90 = 19,37
      expect(
        codes(cleanOption(), context(), {
          ...figures,
          grossAnnualRate: new Decimal('19.38'),
        })
      ).toContain('RATE_ABOVE_MARKET')
      expect(
        codes(cleanOption(), context(), {
          ...figures,
          grossAnnualRate: new Decimal('19.37'),
        })
      ).not.toContain('RATE_ABOVE_MARKET')
    })
  })

  describe('amount', () => {
    it('should alert when the amount is below the minimum', () => {
      expect(codes(cleanOption({ minAmount: new Decimal('50000') }))).toContain(
        'BELOW_MIN_AMOUNT'
      )
    })

    it('should alert concentration considering the new investment', () => {
      // (15.000 + 10.000) / (100.000 + 10.000) = 22,7%
      const ctx = context({
        portfolio: {
          total: new Decimal('100000'),
          byIssuer: [exposure({ amount: new Decimal('15000') })],
        },
      })

      const alert = ComparisonRules.alertsFor(cleanOption(), figures, ctx).find(
        (a) => a.code === 'ISSUER_CONCENTRATION'
      )

      expect(alert?.message).toContain('22,7%')
    })

    it('should flag that IOF was not considered for very short terms', () => {
      expect(
        codes(cleanOption(), context(), { ...figures, holdingDays: 20 })
      ).toContain('SHORT_TERM_IOF')
    })
  })
})
