import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { PortfolioRules } from './portfolio-rules'

const now = new Date('2026-10-06T12:00:00Z')

function codesOf(alerts: { code: string }[]) {
  return alerts.map((alert) => alert.code)
}

// Perfil que não dispara alertas de perfil (reserva = 6x renda, atualizado).
const healthyProfile = () =>
  makeInvestorProfile({
    monthlyIncome: new Decimal('10000'),
    emergencyReserve: new Decimal('60000'),
    updatedAt: now,
  })

describe('Portfolio Rules', () => {
  describe('totals and allocation', () => {
    it('should sum the total and split by asset type and indexer', () => {
      const positions = [
        makePosition({
          assetType: AssetType.CDB,
          indexer: Indexer.CDI,
          investedAmount: new Decimal('50000'),
        }),
        makePosition({
          assetType: AssetType.CDB,
          indexer: Indexer.IPCA,
          investedAmount: new Decimal('25000'),
        }),
        makePosition({
          assetType: AssetType.ACAO,
          indexer: null,
          issuerCnpj: null,
          investedAmount: new Decimal('25000'),
        }),
      ]

      const summary = PortfolioRules.summarize(positions, healthyProfile(), now)

      expect(summary.total.equals('100000')).toBe(true)

      expect(summary.byAssetType.map((item) => item.key)).toEqual([
        AssetType.CDB,
        AssetType.ACAO,
      ])
      expect(summary.byAssetType[0].amount.equals('75000')).toBe(true)
      expect(summary.byAssetType[0].percentage.equals('75')).toBe(true)

      const noIndexer = summary.byIndexer.find((item) => item.key === null)
      expect(noIndexer?.percentage.equals('25')).toBe(true)
    })

    it('should keep exact decimals without float errors', () => {
      const positions = [
        makePosition({ investedAmount: new Decimal('0.1') }),
        makePosition({ investedAmount: new Decimal('0.2') }),
      ]

      const summary = PortfolioRules.summarize(positions, null, now)

      expect(summary.total.toString()).toBe('0.3')
    })

    it('should return zeros for an empty portfolio', () => {
      const summary = PortfolioRules.summarize([], healthyProfile(), now)

      expect(summary.total.isZero()).toBe(true)
      expect(summary.byAssetType).toEqual([])
      expect(summary.byIssuer).toEqual([])
      expect(summary.alerts).toEqual([])
    })
  })

  describe('issuer exposure and FGC', () => {
    it('should group by issuer CNPJ and ignore positions without CNPJ', () => {
      const positions = [
        makePosition({ issuerCnpj: '11111111000111', issuerName: 'Banco A' }),
        makePosition({ issuerCnpj: '11111111000111', issuerName: null }),
        makePosition({ issuerCnpj: '22222222000122' }),
        makePosition({ issuerCnpj: null }),
      ]

      const byIssuer = PortfolioRules.issuerExposures(positions)

      expect(byIssuer).toHaveLength(2)
      expect(
        byIssuer.find((item) => item.issuerCnpj === '11111111000111')
          ?.issuerName
      ).toBe('Banco A')
    })

    it('should sum only FGC-covered products against the FGC limit', () => {
      const positions = [
        makePosition({
          assetType: AssetType.CDB,
          issuerCnpj: '11111111000111',
          investedAmount: new Decimal('150000'),
        }),
        makePosition({
          assetType: AssetType.LCI,
          issuerCnpj: '11111111000111',
          investedAmount: new Decimal('110000'),
        }),
        makePosition({
          assetType: AssetType.DEBENTURE,
          issuerCnpj: '11111111000111',
          investedAmount: new Decimal('500000'),
        }),
      ]

      const [exposure] = PortfolioRules.issuerExposures(positions)

      expect(exposure.amount.equals('760000')).toBe(true)
      expect(exposure.fgcCoveredAmount.equals('260000')).toBe(true)
      expect(exposure.fgcUncoveredAmount.equals('10000')).toBe(true)
    })

    it('should alert when an issuer goes above the FGC limit', () => {
      const positions = [
        makePosition({
          assetType: AssetType.CDB,
          issuerCnpj: '11111111000111',
          issuerName: 'Banco A',
          investedAmount: new Decimal('260000'),
        }),
      ]

      const summary = PortfolioRules.summarize(positions, healthyProfile(), now)

      const alert = summary.alerts.find((a) => a.code === 'ABOVE_FGC_LIMIT')
      expect(alert?.severity).toBe('DANGER')
      expect(alert?.message).toContain('R$ 10.000,00 estão sem garantia')
    })

    it('should not alert exactly at the FGC limit', () => {
      const positions = [
        makePosition({
          assetType: AssetType.CDB,
          issuerCnpj: '11111111000111',
          investedAmount: new Decimal('250000'),
        }),
        makePosition({
          issuerCnpj: '22222222000122',
          investedAmount: new Decimal('1000000'),
          assetType: AssetType.TESOURO,
        }),
      ]

      const summary = PortfolioRules.summarize(positions, healthyProfile(), now)

      expect(codesOf(summary.alerts)).not.toContain('ABOVE_FGC_LIMIT')
    })
  })

  describe('issuer concentration', () => {
    function portfolioWithIssuerShare(issuerAmount: string) {
      return [
        makePosition({
          issuerCnpj: '11111111000111',
          investedAmount: new Decimal(issuerAmount),
        }),
        ...Array.from({ length: 10 }, (_, index) =>
          makePosition({
            issuerCnpj: `9999999900${String(index).padStart(4, '0')}`,
            investedAmount: new Decimal('8000'),
          })
        ),
      ]
    }

    it('should alert when one issuer is above 20% of the portfolio', () => {
      // 21.000 / 101.000 = 20,8%
      const summary = PortfolioRules.summarize(
        portfolioWithIssuerShare('21000'),
        healthyProfile(),
        now
      )

      const alert = summary.alerts.find(
        (a) => a.code === 'ISSUER_CONCENTRATION'
      )
      expect(alert?.severity).toBe('WARNING')
      expect(alert?.message).toContain('20,8%')
    })

    it('should not alert at exactly 20%', () => {
      // 20.000 / 100.000 = 20%
      const summary = PortfolioRules.summarize(
        portfolioWithIssuerShare('20000'),
        healthyProfile(),
        now
      )

      expect(codesOf(summary.alerts)).not.toContain('ISSUER_CONCENTRATION')
    })
  })

  describe('profile alerts', () => {
    it('should ask for the profile when it is missing', () => {
      const summary = PortfolioRules.summarize([], null, now)

      expect(codesOf(summary.alerts)).toEqual(['PROFILE_MISSING'])
    })

    it('should alert when the profile is outdated', () => {
      const profile = makeInvestorProfile({
        monthlyIncome: new Decimal('10000'),
        emergencyReserve: new Decimal('60000'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      })

      const summary = PortfolioRules.summarize([], profile, now)

      expect(codesOf(summary.alerts)).toEqual(['PROFILE_OUTDATED'])
    })

    it('should alert when the reserve is below 6 months of income', () => {
      const profile = makeInvestorProfile({
        monthlyIncome: new Decimal('10000'),
        emergencyReserve: new Decimal('59999.99'),
        updatedAt: now,
      })

      const summary = PortfolioRules.summarize([], profile, now)

      const alert = summary.alerts.find(
        (a) => a.code === 'LOW_EMERGENCY_RESERVE'
      )
      expect(alert?.severity).toBe('WARNING')
      expect(alert?.message).toContain('R$ 60.000,00')
    })
  })
})
