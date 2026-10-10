import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { StockPersonalFit } from './stock-personal-fit'

const banks = {
  label: 'bancos',
  tickers: ['BBAS3', 'ITUB4', 'BBDC4', 'SANB11'],
}

function stock(name: string, amount: string) {
  return makePosition({
    assetType: AssetType.ACAO,
    name,
    investedAmount: new Decimal(amount),
  })
}

function cdb(amount: string) {
  return makePosition({
    assetType: AssetType.CDB,
    name: 'CDB Banco X',
    investedAmount: new Decimal(amount),
  })
}

function codes(input: Parameters<typeof StockPersonalFit.tickerAlerts>[0]) {
  return StockPersonalFit.tickerAlerts(input).map((alert) => alert.code)
}

describe('Stock Personal Fit', () => {
  it('should not alert about concentration on the first investment', () => {
    expect(
      codes({
        ticker: 'BBAS3',
        plannedAmount: new Decimal('5000'),
        group: banks,
        positions: [],
      })
    ).toEqual([])
  })

  it('should tell the user already holds the stock', () => {
    expect(
      codes({
        ticker: 'BBAS3',
        plannedAmount: null,
        group: banks,
        positions: [stock('BBAS3', '5000'), cdb('95000')],
      })
    ).toEqual(['ALREADY_HOLDS'])
  })

  it('should warn when the company would pass the limit', () => {
    // (15.000 + 10.000) / (100.000 + 10.000) = 22,7% > 20%
    expect(
      codes({
        ticker: 'BBAS3',
        plannedAmount: new Decimal('10000'),
        group: null,
        positions: [stock('BBAS3 - Banco do Brasil', '15000'), cdb('85000')],
      })
    ).toContain('COMPANY_CONCENTRATION')
  })

  it('should count the whole sector, not only the ticker', () => {
    const alerts = codes({
      ticker: 'BBAS3',
      plannedAmount: new Decimal('5000'),
      group: banks,
      positions: [
        stock('ITUB4', '20000'),
        stock('BBDC4', '20000'),
        cdb('60000'),
      ],
    })

    // bancos: (40.000 + 5.000) / 105.000 = 42,9% > 35%; BBAS3 sozinho: 4,8%
    expect(alerts).toContain('SECTOR_CONCENTRATION')
    expect(alerts).not.toContain('COMPANY_CONCENTRATION')
  })

  it('should ignore non-stock positions that mention the ticker', () => {
    expect(
      codes({
        ticker: 'BBAS3',
        plannedAmount: null,
        group: banks,
        positions: [cdb('50000')].concat(
          makePosition({
            assetType: AssetType.FUNDO,
            name: 'Fundo BBAS3',
            investedAmount: new Decimal('50000'),
          })
        ),
      })
    ).toEqual([])
  })

  it('should ask for a profile when there is none', () => {
    expect(
      StockPersonalFit.profileAlerts(null).map((alert) => alert.code)
    ).toEqual(['PROFILE_MISSING'])
  })

  it('should not alert for a comfortable profile', () => {
    const profile = makeInvestorProfile({
      monthlyIncome: new Decimal('10000'),
      emergencyReserve: new Decimal('60000'),
      goal: InvestmentGoal.GROWTH,
      horizonMonths: 120,
      riskTolerance: RiskTolerance.HIGH,
    })

    expect(StockPersonalFit.profileAlerts(profile)).toEqual([])
  })

  it('should warn about reserve, goal, risk and horizon', () => {
    const profile = makeInvestorProfile({
      monthlyIncome: new Decimal('10000'),
      emergencyReserve: new Decimal('10000'),
      goal: InvestmentGoal.RESERVE,
      horizonMonths: 12,
      riskTolerance: RiskTolerance.LOW,
    })

    expect(
      StockPersonalFit.profileAlerts(profile).map((alert) => alert.code)
    ).toEqual([
      'LOW_RESERVE_FOR_STOCKS',
      'GOAL_IS_RESERVE',
      'STOCKS_ABOVE_RISK_TOLERANCE',
      'SHORT_HORIZON_FOR_STOCKS',
    ])
  })
})
