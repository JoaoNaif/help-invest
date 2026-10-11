import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { InvestmentGoal } from '@/domain/portfolio/entities/enums/investment-goal'
import { RiskTolerance } from '@/domain/portfolio/entities/enums/risk-tolerance'
import { AssetClass } from '../entities/enums/asset-class'
import { PortfolioStrategy } from '../entities/enums/portfolio-strategy'
import {
  TargetAllocation,
  TargetAllocationInput,
  TargetRanges,
} from './target-allocation'

function build(override: Partial<TargetAllocationInput> = {}) {
  return TargetAllocation.build({
    riskTolerance: RiskTolerance.MEDIUM,
    horizonMonths: 120,
    goal: InvestmentGoal.GROWTH,
    strategy: PortfolioStrategy.BALANCE,
    ...override,
  })
}

function bounds(ranges: TargetRanges, assetClass: keyof TargetRanges) {
  return [ranges[assetClass].min.toString(), ranges[assetClass].max.toString()]
}

describe('Target Allocation', () => {
  it('should use the base table of the risk tolerance for a long horizon', () => {
    const { ranges, capApplied, variableIncomeCapPercent } = build()

    expect(bounds(ranges, AssetClass.FIXED_POST)).toEqual(['20', '40'])
    expect(bounds(ranges, AssetClass.STOCKS)).toEqual(['10', '25'])
    expect(bounds(ranges, AssetClass.REAL_ESTATE_FUNDS)).toEqual(['10', '20'])
    expect(bounds(ranges, AssetClass.CRYPTO)).toEqual(['0', '5'])
    expect(capApplied).toBe(false)
    expect(variableIncomeCapPercent).toBeNull()
  })

  it('should pick a different table per risk tolerance', () => {
    const low = build({ riskTolerance: RiskTolerance.LOW }).ranges
    const high = build({ riskTolerance: RiskTolerance.HIGH }).ranges

    expect(bounds(low, AssetClass.FIXED_POST)).toEqual(['40', '60'])
    expect(bounds(low, AssetClass.CRYPTO)).toEqual(['0', '0'])
    expect(bounds(high, AssetClass.STOCKS)).toEqual(['25', '40'])
  })

  it('should keep variable income at 60 months without a cap', () => {
    const { capApplied } = build({ horizonMonths: 60 })

    expect(capApplied).toBe(false)
  })

  it('should cap variable income at 25% for 36 to 59 months', () => {
    const result = build({ horizonMonths: 48 })

    const sumMax = [
      AssetClass.STOCKS,
      AssetClass.REAL_ESTATE_FUNDS,
      AssetClass.CRYPTO,
    ].reduce(
      (total, assetClass) => total.plus(result.ranges[assetClass].max),
      new Decimal(0)
    )

    expect(result.capApplied).toBe(true)
    expect(result.variableIncomeCapPercent?.toString()).toBe('25')
    expect(sumMax.toNumber()).toBeCloseTo(25, 10)
  })

  it('should cap variable income at 10% under 36 months', () => {
    const result = build({ horizonMonths: 12 })

    const sumMax = [
      AssetClass.STOCKS,
      AssetClass.REAL_ESTATE_FUNDS,
      AssetClass.CRYPTO,
    ].reduce(
      (total, assetClass) => total.plus(result.ranges[assetClass].max),
      new Decimal(0)
    )

    expect(result.variableIncomeCapPercent?.toString()).toBe('10')
    expect(sumMax.toNumber()).toBeCloseTo(10, 10)
  })

  it('should send what the cap removed to fixed post and inflation, half each', () => {
    const base = build({ horizonMonths: 120 })
    const capped = build({ horizonMonths: 12 })

    // MEDIUM: renda variável vai de 50 (soma dos máximos) para 10 → saem 40.
    expect(capped.redistributed.max.toNumber()).toBeCloseTo(40, 10)

    expect(
      capped.ranges.FIXED_POST.max.minus(base.ranges.FIXED_POST.max).toNumber()
    ).toBeCloseTo(20, 10)
    expect(
      capped.ranges.FIXED_INFLATION.max
        .minus(base.ranges.FIXED_INFLATION.max)
        .toNumber()
    ).toBeCloseTo(20, 10)
  })

  it('should not push a fixed income ceiling above 100%', () => {
    const { ranges } = build({
      riskTolerance: RiskTolerance.LOW,
      horizonMonths: 6,
      strategy: PortfolioStrategy.PROTECT,
    })

    expect(ranges.FIXED_POST.max.lessThanOrEqualTo(100)).toBe(true)
    expect(ranges.FIXED_INFLATION.max.lessThanOrEqualTo(100)).toBe(true)
  })

  it('should treat the RESERVE goal as a short horizon', () => {
    const result = build({
      goal: InvestmentGoal.RESERVE,
      horizonMonths: 240,
    })

    expect(result.effectiveHorizonMonths).toBe(35)
    expect(result.variableIncomeCapPercent?.toString()).toBe('10')
    expect(result.capApplied).toBe(true)
  })

  it('should use the upper half of variable income ranges for MAX_RETURN', () => {
    const { ranges, strategyAdjusted } = build({
      strategy: PortfolioStrategy.MAX_RETURN,
    })

    expect(bounds(ranges, AssetClass.STOCKS)).toEqual(['17.5', '25'])
    expect(bounds(ranges, AssetClass.REAL_ESTATE_FUNDS)).toEqual(['15', '20'])
    expect(strategyAdjusted).toEqual([
      AssetClass.STOCKS,
      AssetClass.REAL_ESTATE_FUNDS,
      AssetClass.CRYPTO,
    ])
  })

  it('should use the lower half of variable income ranges for PROTECT', () => {
    const { ranges } = build({ strategy: PortfolioStrategy.PROTECT })

    expect(bounds(ranges, AssetClass.STOCKS)).toEqual(['10', '17.5'])
    expect(bounds(ranges, AssetClass.REAL_ESTATE_FUNDS)).toEqual(['10', '15'])
  })

  it('should favor real estate funds and inflation-linked fixed income for INCOME', () => {
    const { ranges, strategyAdjusted } = build({
      strategy: PortfolioStrategy.INCOME,
    })

    expect(bounds(ranges, AssetClass.REAL_ESTATE_FUNDS)).toEqual(['15', '20'])
    expect(bounds(ranges, AssetClass.FIXED_INFLATION)).toEqual(['22.5', '30'])
    expect(bounds(ranges, AssetClass.STOCKS)).toEqual(['10', '25'])
    expect(strategyAdjusted).toEqual([
      AssetClass.REAL_ESTATE_FUNDS,
      AssetClass.FIXED_INFLATION,
    ])
  })

  it('should never let the strategy go past the risk ceiling', () => {
    const high = build({
      riskTolerance: RiskTolerance.HIGH,
      strategy: PortfolioStrategy.MAX_RETURN,
    })
    const low = build({
      riskTolerance: RiskTolerance.LOW,
      strategy: PortfolioStrategy.MAX_RETURN,
    })

    expect(high.ranges.STOCKS.max.toString()).toBe('40')
    expect(low.ranges.STOCKS.max.toString()).toBe('5')
  })
})
