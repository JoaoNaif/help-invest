import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { SelicTrend } from '@/domain/portfolio-analysis/entities/enums/selic-trend'
import { ReadingTopic } from '../entities/enums/reading-topic'
import { Stance } from '../entities/enums/stance'
import { MarketReadings } from './market-readings'

const d = (value: string) => new Decimal(value)

function readings(realRate: string | null, trend: SelicTrend | null) {
  const real = realRate ? d(realRate) : null

  return MarketReadings.build({
    selic: real ? d('14.75') : null,
    ipca12m: real ? d('4.91') : null,
    realRate: real,
    trend,
  })
}

function stances(realRate: string | null, trend: SelicTrend | null) {
  return Object.fromEntries(
    readings(realRate, trend).map((reading) => [reading.topic, reading.stance])
  )
}

const {
  FIXED_POST,
  FIXED_PRE,
  FIXED_INFLATION,
  TAX_EXEMPT,
  STOCKS,
  REAL_ESTATE_FUNDS,
} = ReadingTopic
const { FAVORED, NEUTRAL, LESS_FAVORED, UNAVAILABLE } = Stance
const { FALLING, STABLE, RISING } = SelicTrend

describe('Market Readings', () => {
  describe('stance by topic', () => {
    it('should favor fixed income on a high real rate with a stable Selic', () => {
      expect(stances('9.4', STABLE)).toEqual({
        [FIXED_POST]: FAVORED,
        [FIXED_INFLATION]: FAVORED,
        [FIXED_PRE]: NEUTRAL,
        [TAX_EXEMPT]: FAVORED,
        [STOCKS]: LESS_FAVORED,
        [REAL_ESTATE_FUNDS]: LESS_FAVORED,
      })
    })

    it('should lock the real rate when it is high but the Selic is falling', () => {
      expect(stances('9.4', FALLING)).toEqual({
        [FIXED_POST]: NEUTRAL,
        [FIXED_INFLATION]: FAVORED,
        [FIXED_PRE]: FAVORED,
        [TAX_EXEMPT]: NEUTRAL,
        [STOCKS]: NEUTRAL,
        [REAL_ESTATE_FUNDS]: NEUTRAL,
      })
    })

    it('should favor post-fixed and hurt prefixed when the Selic is rising', () => {
      expect(stances('9.4', RISING)).toEqual({
        [FIXED_POST]: FAVORED,
        [FIXED_INFLATION]: FAVORED,
        [FIXED_PRE]: LESS_FAVORED,
        [TAX_EXEMPT]: FAVORED,
        [STOCKS]: LESS_FAVORED,
        [REAL_ESTATE_FUNDS]: LESS_FAVORED,
      })
    })

    it('should favor variable income on a low real rate', () => {
      expect(stances('2.5', STABLE)).toEqual({
        [FIXED_POST]: LESS_FAVORED,
        [FIXED_INFLATION]: LESS_FAVORED,
        [FIXED_PRE]: NEUTRAL,
        [TAX_EXEMPT]: LESS_FAVORED,
        [STOCKS]: FAVORED,
        [REAL_ESTATE_FUNDS]: FAVORED,
      })
    })

    it('should not favor prefixed with a low real rate even if the Selic falls', () => {
      expect(stances('2.5', FALLING)[FIXED_PRE]).toBe(NEUTRAL)
    })

    it('should let LESS_FAVORED win when a low real rate meets a rising Selic', () => {
      const result = stances('2.5', RISING)

      expect(result[FIXED_POST]).toBe(LESS_FAVORED)
      expect(result[FIXED_PRE]).toBe(LESS_FAVORED)
    })

    it('should read a falling Selic with a middle real rate', () => {
      expect(stances('4.5', FALLING)).toEqual({
        [FIXED_POST]: LESS_FAVORED,
        [FIXED_INFLATION]: NEUTRAL,
        [FIXED_PRE]: FAVORED,
        [TAX_EXEMPT]: LESS_FAVORED,
        [STOCKS]: FAVORED,
        [REAL_ESTATE_FUNDS]: FAVORED,
      })
    })

    it('should be neutral everywhere in the middle with a stable Selic', () => {
      expect(Object.values(stances('4.5', STABLE))).toEqual(
        Array(6).fill(NEUTRAL)
      )
    })

    it('should favor post-fixed on a rising Selic even in the middle band', () => {
      expect(stances('4.5', RISING)).toMatchObject({
        [FIXED_POST]: FAVORED,
        [FIXED_PRE]: LESS_FAVORED,
        [STOCKS]: NEUTRAL,
      })
    })

    it('should treat the thresholds as inclusive/exclusive as documented', () => {
      // 6% já é alto; 3% já não é baixo.
      expect(stances('6', STABLE)[FIXED_INFLATION]).toBe(FAVORED)
      expect(stances('3', STABLE)[FIXED_INFLATION]).toBe(NEUTRAL)
      expect(stances('2.99', STABLE)[FIXED_INFLATION]).toBe(LESS_FAVORED)
    })
  })

  describe('missing data', () => {
    it('should be UNAVAILABLE everywhere without any data', () => {
      expect(Object.values(stances(null, null))).toEqual(
        Array(6).fill(UNAVAILABLE)
      )
    })

    it('should not fire the trend rules without Selic history', () => {
      expect(stances('9.4', null)).toEqual({
        [FIXED_POST]: FAVORED,
        [FIXED_INFLATION]: FAVORED,
        [FIXED_PRE]: UNAVAILABLE,
        [TAX_EXEMPT]: FAVORED,
        [STOCKS]: LESS_FAVORED,
        [REAL_ESTATE_FUNDS]: LESS_FAVORED,
      })
    })

    it('should read only the trend rules without a real rate', () => {
      expect(stances(null, RISING)).toEqual({
        [FIXED_POST]: FAVORED,
        [FIXED_INFLATION]: UNAVAILABLE,
        [FIXED_PRE]: LESS_FAVORED,
        [TAX_EXEMPT]: FAVORED,
        [STOCKS]: NEUTRAL,
        [REAL_ESTATE_FUNDS]: NEUTRAL,
      })
    })

    it('should not conclude on a falling Selic without a real rate', () => {
      expect(stances(null, FALLING)).toMatchObject({
        [FIXED_POST]: UNAVAILABLE,
        [FIXED_PRE]: UNAVAILABLE,
        [TAX_EXEMPT]: UNAVAILABLE,
        [STOCKS]: FAVORED,
      })
    })
  })

  describe('reasons and premises', () => {
    it('should always bring a first reason with the numbers used', () => {
      for (const reading of readings('9.4', FALLING)) {
        expect(reading.reasons.length).toBeGreaterThan(0)
        expect(reading.reasons[0].code).toBe('MARKET_NUMBERS')
        expect(reading.reasons[0].message).toContain('Selic 14,75%')
        expect(reading.reasons[0].message).toContain('IPCA 12m 4,91%')
        expect(reading.reasons[0].message).toContain('juro real 9,40% a.a.')
      }
    })

    it('should say when there is no number to show', () => {
      for (const reading of readings(null, null)) {
        expect(reading.reasons.map((reason) => reason.code)).toEqual([
          'DATA_UNAVAILABLE',
          'DATA_UNAVAILABLE',
        ])
      }
    })

    it('should explain the thresholds as premises', () => {
      const post = readings('9.4', STABLE).find(
        (reading) => reading.topic === FIXED_POST
      )!

      expect(post.premises.map((premise) => premise.code)).toEqual(
        expect.arrayContaining([
          'REAL_RATE_HIGH_THRESHOLD',
          'REAL_RATE_LOW_THRESHOLD',
          'SELIC_TREND_WINDOW',
        ])
      )
      expect(
        post.premises.find((p) => p.code === 'REAL_RATE_HIGH_THRESHOLD')
          ?.message
      ).toBe('Juro real a partir de 6% é considerado alto.')
    })

    it('should state that variable income reads only from interest rates', () => {
      for (const topic of [STOCKS, REAL_ESTATE_FUNDS]) {
        const reading = readings('9.4', STABLE).find(
          (item) => item.topic === topic
        )!

        expect(reading.premises.map((premise) => premise.code)).toContain(
          'NO_EQUITY_MARKET_DATA'
        )
      }
    })

    it('should mention the income tax table in the tax exempt premises', () => {
      const exempt = readings('9.4', STABLE).find(
        (reading) => reading.topic === TAX_EXEMPT
      )!

      expect(exempt.premises.map((premise) => premise.code)).toContain(
        'INCOME_TAX_REGRESSIVE'
      )
    })

    it('should return the topics in display order', () => {
      expect(readings('9.4', STABLE).map((reading) => reading.topic)).toEqual([
        FIXED_POST,
        FIXED_PRE,
        FIXED_INFLATION,
        TAX_EXEMPT,
        STOCKS,
        REAL_ESTATE_FUNDS,
      ])
    })

    it('should never tell the user to buy or sell', () => {
      const texts = [
        ...readings('9.4', FALLING),
        ...readings('2.5', RISING),
        ...readings('4.5', STABLE),
      ].flatMap((reading) =>
        [...reading.reasons, ...reading.premises].map((n) => n.message)
      )

      for (const text of texts) {
        expect(text).not.toMatch(/\b(compre|comprar|venda|vender|invista)\b/i)
      }
    })
  })
})
