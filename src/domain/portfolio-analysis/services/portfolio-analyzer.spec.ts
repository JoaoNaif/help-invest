import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { makeInvestorProfile } from 'test/factories/make-investor-profile'
import { makePosition } from 'test/factories/make-position'
import { AssetClass } from '../entities/enums/asset-class'
import { PathDirection } from '../entities/enums/path-direction'
import { PortfolioStrategy } from '../entities/enums/portfolio-strategy'
import { SelicTrend } from '../entities/enums/selic-trend'
import {
  MarketReading,
  PortfolioAnalyzer,
  PortfolioAnalyzerInput,
} from './portfolio-analyzer'

const NOW = new Date('2026-10-10T12:00:00Z')

const d = (value: string) => new Decimal(value)

const MARKET: MarketReading = {
  selic: d('14.75'),
  cdi: d('14.65'),
  ipca12m: d('4.8'),
  selicSixMonthsAgo: d('15'),
  asOf: new Date('2026-10-09T00:00:00Z'),
  ipcaAsOf: new Date('2026-09-01T00:00:00Z'),
}

const NO_MARKET: MarketReading = {
  selic: null,
  cdi: null,
  ipca12m: null,
  selicSixMonthsAgo: null,
  asOf: null,
  ipcaAsOf: null,
}

function analyze(override: Partial<PortfolioAnalyzerInput> = {}) {
  return PortfolioAnalyzer.analyze({
    positions: [],
    profile: null,
    strategy: PortfolioStrategy.BALANCE,
    market: MARKET,
    now: NOW,
    ...override,
  })
}

function position(
  assetType: AssetType,
  indexer: Indexer | null,
  amount: string
) {
  return makePosition({
    assetType,
    indexer,
    investedAmount: d(amount),
    issuerCnpj: null,
  })
}

const codes = (alerts: { code: string }[]) => alerts.map((alert) => alert.code)

describe('Portfolio Analyzer', () => {
  it('should show the full target when the portfolio is empty', () => {
    const { report } = analyze()

    expect(report.total).toBe('0.00')
    expect(codes(report.alerts)).toContain('PORTFOLIO_EMPTY')

    const byClass = Object.fromEntries(
      report.paths.map((path) => [path.assetClass, path])
    )

    expect(byClass.FIXED_POST).toMatchObject({
      direction: PathDirection.INCREASE,
      currentPercentage: '0.00',
      targetMin: '20.00',
      targetMax: '40.00',
      gapPercentage: '20.00',
    })
    expect(byClass.STOCKS.gapPercentage).toBe('10.00')
    // faixa começa em zero: nada a aumentar
    expect(byClass.CRYPTO.direction).toBe(PathDirection.MAINTAIN)
    expect(byClass.FIXED_PRE.direction).toBe(PathDirection.MAINTAIN)
  })

  it('should use MEDIUM and 60 months without a profile and say so', () => {
    const { report, assumptions } = analyze()

    expect(report.profileUsed).toEqual({
      riskTolerance: RiskTolerance.MEDIUM,
      horizonMonths: 60,
      goal: null,
      isDefault: true,
    })
    expect(report.reserve).toBeNull()
    expect(codes(report.alerts)).toContain('PROFILE_MISSING')
    expect(assumptions.targetAllocation).toMatchObject({
      riskTolerance: 'MEDIUM',
      horizonMonths: 60,
    })
  })

  it('should use the profile when there is one', () => {
    const profile = makeInvestorProfile({
      riskTolerance: RiskTolerance.LOW,
      horizonMonths: 120,
      goal: InvestmentGoal.RETIREMENT,
    })

    const { report } = analyze({ profile })

    expect(report.profileUsed).toEqual({
      riskTolerance: RiskTolerance.LOW,
      horizonMonths: 120,
      goal: InvestmentGoal.RETIREMENT,
      isDefault: false,
    })
    expect(codes(report.alerts)).not.toContain('PROFILE_MISSING')
  })

  it('should compute shares and flag a concentrated class as REDUCE', () => {
    const { report } = analyze({
      positions: [
        position(AssetType.CDB, Indexer.CDI, '9000'),
        position(AssetType.TESOURO, Indexer.IPCA, '1000'),
      ],
    })

    expect(report.total).toBe('10000.00')
    expect(report.current[0]).toEqual({
      assetClass: AssetClass.FIXED_POST,
      amount: '9000.00',
      percentage: '90.00',
    })

    const post = report.paths.find(
      (path) => path.assetClass === AssetClass.FIXED_POST
    )!

    expect(post.direction).toBe(PathDirection.REDUCE)
    expect(post.gapPercentage).toBe('50.00')
    // o maior desvio vem primeiro
    expect(report.paths[0].assetClass).toBe(AssetClass.FIXED_POST)
    expect(post.reasons[0].code).toBe('ABOVE_TARGET_RANGE')
  })

  it('should mark a class inside its range as MAINTAIN with no gap', () => {
    const { report } = analyze({
      positions: [
        position(AssetType.CDB, Indexer.CDI, '3000'),
        position(AssetType.TESOURO, Indexer.IPCA, '2000'),
        position(AssetType.ACAO, null, '1500'),
        position(AssetType.FII, null, '1500'),
        position(AssetType.CDB, Indexer.PRE, '2000'),
      ],
    })

    const stocks = report.paths.find(
      (path) => path.assetClass === AssetClass.STOCKS
    )!

    expect(stocks).toMatchObject({
      direction: PathDirection.MAINTAIN,
      currentPercentage: '15.00',
      gapPercentage: '0.00',
    })
    expect(stocks.reasons[0].code).toBe('WITHIN_TARGET_RANGE')
  })

  it('should break gap ties by the market scenario', () => {
    const profile = makeInvestorProfile({
      riskTolerance: RiskTolerance.HIGH,
      horizonMonths: 120,
      goal: InvestmentGoal.GROWTH,
    })
    // Juro real baixo reforça fundos imobiliários, empatados em 10 pontos
    // com pós-fixada e inflação.
    const lowRealRate: MarketReading = {
      ...MARKET,
      selic: d('8'),
      ipca12m: d('6'),
    }

    const order = (market: MarketReading) =>
      analyze({ profile, market }).report.paths.map((path) => path.assetClass)

    expect(order(lowRealRate).slice(0, 4)).toEqual([
      AssetClass.STOCKS,
      AssetClass.REAL_ESTATE_FUNDS,
      AssetClass.FIXED_POST,
      AssetClass.FIXED_INFLATION,
    ])
    // Sem cenário o desempate é a ordem de exibição.
    expect(order(NO_MARKET).slice(0, 4)).toEqual([
      AssetClass.STOCKS,
      AssetClass.FIXED_POST,
      AssetClass.FIXED_INFLATION,
      AssetClass.REAL_ESTATE_FUNDS,
    ])
  })

  it('should explain the scenario in the reasons of affected paths', () => {
    const { report } = analyze()

    const post = report.paths.find(
      (path) => path.assetClass === AssetClass.FIXED_POST
    )!
    const stocks = report.paths.find(
      (path) => path.assetClass === AssetClass.STOCKS
    )!

    expect(post.reasons.map((reason) => reason.code)).toContain(
      'SCENARIO_HIGH_REAL_RATE'
    )
    expect(stocks.reasons.map((reason) => reason.code)).toContain(
      'SCENARIO_HIGH_REAL_RATE_VARIABLE_INCOME'
    )
  })

  it('should publish the market context with source dates', () => {
    // Selic caiu 0,5 ponto em 6 meses: limiar da tendência.
    const { report } = analyze({
      market: { ...MARKET, selicSixMonthsAgo: d('15.25') },
    })

    expect(report.market).toEqual({
      selic: '14.75',
      cdi: '14.65',
      ipca12m: '4.80',
      realRate: '9.49',
      selicTrend: SelicTrend.FALLING,
      asOf: '2026-10-09',
      ipcaAsOf: '2026-09-01',
    })
  })

  it('should keep null (never zero) and warn when market data is missing', () => {
    const { report } = analyze({ market: NO_MARKET })

    expect(report.market).toEqual({
      selic: null,
      cdi: null,
      ipca12m: null,
      realRate: null,
      selicTrend: null,
      asOf: null,
      ipcaAsOf: null,
    })
    expect(codes(report.alerts)).toContain('MARKET_DATA_UNAVAILABLE')
    // sem cenário, nenhum motivo de mercado
    expect(
      report.paths.flatMap((path) => path.reasons.map((reason) => reason.code))
    ).not.toContain('SCENARIO_HIGH_REAL_RATE')
  })

  it('should not fire the trend rule without Selic history', () => {
    const { report } = analyze({
      market: { ...MARKET, selicSixMonthsAgo: null },
    })

    expect(report.market.selicTrend).toBeNull()
    expect(report.market.realRate).toBe('9.49')
  })

  it('should flag variable income paths when the reserve is low', () => {
    const profile = makeInvestorProfile({
      monthlyIncome: d('10000'),
      emergencyReserve: d('10000'),
      riskTolerance: RiskTolerance.MEDIUM,
      horizonMonths: 120,
    })

    const { report } = analyze({ profile })

    expect(report.reserve).toEqual({
      recommended: '60000.00',
      current: '10000.00',
      gap: '50000.00',
      isBelowRecommended: true,
    })

    const stocks = report.paths.find(
      (path) => path.assetClass === AssetClass.STOCKS
    )!
    const post = report.paths.find(
      (path) => path.assetClass === AssetClass.FIXED_POST
    )!

    expect(stocks.risks.map((risk) => risk.code)).toContain(
      'LOW_RESERVE_FOR_STOCKS'
    )
    expect(post.risks.map((risk) => risk.code)).not.toContain(
      'LOW_RESERVE_FOR_STOCKS'
    )
    expect(codes(report.alerts)).toContain('LOW_EMERGENCY_RESERVE')
  })

  it('should not flag the reserve when it is complete', () => {
    const profile = makeInvestorProfile({
      monthlyIncome: d('5000'),
      emergencyReserve: d('30000'),
    })

    const { report } = analyze({ profile })

    expect(report.reserve).toMatchObject({
      gap: '0.00',
      isBelowRecommended: false,
    })
    expect(
      report.paths.flatMap((path) => path.risks.map((risk) => risk.code))
    ).not.toContain('LOW_RESERVE_FOR_STOCKS')
  })

  it('should keep funds and other assets out of the targets but alert when large', () => {
    const { report } = analyze({
      positions: [
        position(AssetType.CDB, Indexer.CDI, '5000'),
        position(AssetType.FUNDO, null, '3000'),
        position(AssetType.OUTRO, null, '2000'),
      ],
    })

    expect(report.current.map((share) => share.assetClass)).toEqual(
      expect.arrayContaining([AssetClass.FUNDS, AssetClass.OTHER])
    )
    expect(report.target.map((target) => target.assetClass)).not.toContain(
      AssetClass.FUNDS
    )
    expect(report.paths.map((path) => path.assetClass as string)).not.toContain(
      AssetClass.FUNDS
    )
    expect(codes(report.alerts)).toContain('UNCLASSIFIED_ALLOCATION')
  })

  it('should warn when MAX_RETURN is limited by the profile', () => {
    const profile = makeInvestorProfile({
      riskTolerance: RiskTolerance.LOW,
      horizonMonths: 120,
    })

    const { report } = analyze({
      profile,
      strategy: PortfolioStrategy.MAX_RETURN,
    })

    expect(codes(report.alerts)).toContain('STRATEGY_LIMITED_BY_PROFILE')
  })

  it('should say when the horizon caps variable income', () => {
    const profile = makeInvestorProfile({
      riskTolerance: RiskTolerance.HIGH,
      horizonMonths: 12,
    })

    const { report } = analyze({ profile })

    expect(codes(report.alerts)).toContain('HORIZON_CAPS_VARIABLE_INCOME')

    const stocks = report.paths.find(
      (path) => path.assetClass === AssetClass.STOCKS
    )!

    expect(stocks.reasons.map((reason) => reason.code)).toContain(
      'HORIZON_CAPS_RANGE'
    )
  })

  it('should always say that there is no equity market data', () => {
    expect(codes(analyze().report.alerts)).toContain('NO_EQUITY_MARKET_DATA')
  })

  it('should record the assumptions used', () => {
    const { assumptions } = analyze({ strategy: PortfolioStrategy.INCOME })

    expect(assumptions.strategy).toBe('INCOME')
    expect(assumptions.targetAllocation).toMatchObject({
      source: expect.stringContaining('Regra do produto'),
      strategyAdjustedClasses: ['REAL_ESTATE_FUNDS', 'FIXED_INFLATION'],
    })
    expect(assumptions.scenario).toMatchObject({
      realRateHighPercent: '6',
      realRateLowPercent: '3',
      selicTrendMonths: 6,
    })
  })
})
