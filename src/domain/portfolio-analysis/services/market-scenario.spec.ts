import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { AssetClass } from '../entities/enums/asset-class'
import { SelicTrend } from '../entities/enums/selic-trend'
import { MarketScenario, ScenarioBias } from './market-scenario'

const d = (value: string) => new Decimal(value)

describe('Market Scenario', () => {
  describe('real rate', () => {
    it('should compute the real rate from Selic and IPCA (Fisher)', () => {
      const realRate = MarketScenario.realRate(d('14.75'), d('4.8'))

      // (1,1475 / 1,048) - 1 = 9,4943...%
      expect(realRate!.toFixed(2)).toBe('9.49')
    })

    it('should be null without Selic or IPCA', () => {
      expect(MarketScenario.realRate(null, d('4.8'))).toBeNull()
      expect(MarketScenario.realRate(d('14.75'), null)).toBeNull()
    })
  })

  describe('Selic trend', () => {
    it('should detect a falling Selic', () => {
      expect(MarketScenario.trend(d('14.25'), d('15'))).toBe(SelicTrend.FALLING)
    })

    it('should detect a rising Selic', () => {
      expect(MarketScenario.trend(d('15'), d('13.75'))).toBe(SelicTrend.RISING)
    })

    it('should be stable under the threshold', () => {
      expect(MarketScenario.trend(d('14.75'), d('15'))).toBe(SelicTrend.STABLE)
    })

    it('should be null without enough history', () => {
      expect(MarketScenario.trend(d('14.75'), null)).toBeNull()
      expect(MarketScenario.trend(null, d('14.75'))).toBeNull()
    })
  })

  describe('assessment', () => {
    it('should favor fixed income on a high real rate', () => {
      const assessment = MarketScenario.assess(d('9.5'), SelicTrend.STABLE)

      expect(assessment.bias).toBe(ScenarioBias.FAVOR_FIXED)
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.FIXED_POST)
      ).toBe(1)
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.FIXED_INFLATION)
      ).toBe(1)
      expect(MarketScenario.effectOn(assessment.bias, AssetClass.STOCKS)).toBe(
        -1
      )
    })

    it('should favor variable income on a low real rate', () => {
      const assessment = MarketScenario.assess(d('2.5'), SelicTrend.STABLE)

      expect(assessment.bias).toBe(ScenarioBias.FAVOR_VARIABLE)
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.REAL_ESTATE_FUNDS)
      ).toBe(1)
      expect(MarketScenario.effectOn(assessment.bias, AssetClass.STOCKS)).toBe(
        1
      )
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.FIXED_POST)
      ).toBe(0)
    })

    it('should favor variable income when the Selic is falling', () => {
      const assessment = MarketScenario.assess(d('4.5'), SelicTrend.FALLING)

      expect(assessment.bias).toBe(ScenarioBias.FAVOR_VARIABLE)
      expect(assessment.cause).toBe('FALLING_SELIC')
    })

    it('should lock the real rate when it is high but the Selic is falling', () => {
      const assessment = MarketScenario.assess(d('9.5'), SelicTrend.FALLING)

      expect(assessment.bias).toBe(ScenarioBias.FAVOR_LOCK_IN)
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.FIXED_INFLATION)
      ).toBe(1)
      expect(
        MarketScenario.effectOn(assessment.bias, AssetClass.FIXED_POST)
      ).toBe(0)
      expect(MarketScenario.effectOn(assessment.bias, AssetClass.STOCKS)).toBe(
        0
      )
    })

    it('should be neutral between the thresholds with a stable Selic', () => {
      expect(MarketScenario.assess(d('4.5'), SelicTrend.STABLE).bias).toBe(
        ScenarioBias.NEUTRAL
      )
    })

    it('should not fire any rule without data', () => {
      expect(MarketScenario.assess(null, null)).toEqual({
        bias: ScenarioBias.NEUTRAL,
        cause: null,
      })
    })

    it('should still use the trend when the real rate is unavailable', () => {
      expect(MarketScenario.assess(null, SelicTrend.FALLING).bias).toBe(
        ScenarioBias.FAVOR_VARIABLE
      )
    })

    it('should write the reason in pt-BR for affected classes only', () => {
      const assessment = MarketScenario.assess(d('9.5'), SelicTrend.STABLE)

      expect(
        MarketScenario.reasonFor(assessment, AssetClass.FIXED_POST, d('9.5'))
          ?.code
      ).toBe('SCENARIO_HIGH_REAL_RATE')
      expect(
        MarketScenario.reasonFor(assessment, AssetClass.FIXED_PRE, d('9.5'))
      ).toBeNull()
    })
  })
})
