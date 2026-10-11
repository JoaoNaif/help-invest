import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { MarketIndexCode } from '@/domain/market-overview/applications/dtos/market-index'
import { MarketIndexProvider } from '@/domain/market-overview/applications/gateways/market-index-provider'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { signIn } from 'test/e2e/sign-in'
import {
  FakeMarketIndexProvider,
  makeIndexCloses,
} from 'test/gateways/fake-market-index-provider'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

interface ReadingBody {
  topic: string
  stance: string
  reasons: { code: string; message: string }[]
  premises: { code: string }[]
}

describe('Market overview (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  // A fonte real (Yahoo) é de terceiros e instável: nos e2e vai um fake.
  const indices = new FakeMarketIndexProvider()
  let cookie: string

  async function seedIndicators() {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6)
    sixMonthsAgo.setUTCDate(sixMonthsAgo.getUTCDate() - 3)

    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today)
      date.setUTCDate(1)
      date.setUTCMonth(date.getUTCMonth() - index - 1)
      return date
    })

    await prisma.indicatorValue.createMany({
      data: [
        { indicator: 'SELIC', date: today, value: '14.75', source: 'test' },
        { indicator: 'CDI', date: today, value: '14.65', source: 'test' },
        {
          indicator: 'SELIC',
          date: sixMonthsAgo,
          value: '15.5',
          source: 'test',
        },
        ...months.map((date) => ({
          indicator: 'IPCA' as const,
          date,
          value: '0.4',
          source: 'test',
        })),
      ],
    })
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MarketIndexProvider)
      .useValue(indices)
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    prisma = moduleRef.get(PrismaService)
    await app.init()

    cookie = await signIn(app, 'market-overview@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[GET] /market-overview requires authentication', async () => {
    const response = await request(app.getHttpServer()).get('/market-overview')

    expect(response.statusCode).toBe(401)
  })

  test('[GET] /market-overview without any indicator', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-overview')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)

    const { overview } = response.body

    expect(overview.rates).toEqual({
      selic: null,
      cdi: null,
      ipca12m: null,
      realRate: null,
      selicTrend: null,
    })
    expect(overview.history).toEqual({ selic: [], ipcaMonthly: [] })
    expect(overview.equivalences).toEqual([])
    expect(overview.market).toEqual({ ibovespa: null, ifix: null })
    expect(
      overview.readings.map((reading: ReadingBody) => reading.stance)
    ).toEqual(Array(6).fill('UNAVAILABLE'))
    expect(
      overview.alerts.map((alert: { code: string }) => alert.code)
    ).toEqual([
      'MARKET_DATA_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'NO_EQUITY_MARKET_DATA',
    ])
  })

  test('[GET] /market-overview with data', async () => {
    await seedIndicators()

    const response = await request(app.getHttpServer())
      .get('/market-overview')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)

    const { overview } = response.body

    expect(overview.generatedAt).toEqual(expect.any(String))
    expect(overview.rates).toMatchObject({
      selic: { value: '14.75' },
      cdi: { value: '14.65' },
      ipca12m: { value: '4.91' },
      realRate: { value: '9.38' },
      selicTrend: 'FALLING',
    })
    expect(overview.history.ipcaMonthly).toHaveLength(12)
    expect(overview.history.selic.length).toBeGreaterThan(0)

    const readings: ReadingBody[] = overview.readings

    expect(readings.map((reading) => reading.topic)).toEqual([
      'FIXED_POST',
      'FIXED_PRE',
      'FIXED_INFLATION',
      'TAX_EXEMPT',
      'STOCKS',
      'REAL_ESTATE_FUNDS',
    ])
    // juro real alto com Selic em queda: trava IPCA+ e prefixado
    expect(
      Object.fromEntries(
        readings.map((reading) => [reading.topic, reading.stance])
      )
    ).toEqual({
      FIXED_POST: 'NEUTRAL',
      FIXED_PRE: 'FAVORED',
      FIXED_INFLATION: 'FAVORED',
      TAX_EXEMPT: 'NEUTRAL',
      STOCKS: 'NEUTRAL',
      REAL_ESTATE_FUNDS: 'NEUTRAL',
    })

    for (const reading of readings) {
      expect(reading.reasons.length).toBeGreaterThan(0)
      expect(reading.reasons[0].message).toContain('Selic 14,75%')
    }

    expect(overview.equivalences).toHaveLength(1)
    expect(overview.equivalences[0].exemptPercentOfCdi).toBe('90.00')
    expect(overview.equivalences[0].brackets[0]).toEqual({
      label: 'até 180 dias',
      incomeTaxRate: '22.50',
      equivalentTaxedPercentOfCdi: '116.13',
    })
    expect(
      overview.alerts.map((alert: { code: string }) => alert.code)
    ).toEqual([
      'INDEX_UNAVAILABLE',
      'INDEX_UNAVAILABLE',
      'NO_EQUITY_MARKET_DATA',
    ])
    expect(overview.assumptions.realRateHighPercent).toBe('6')
  })

  test('[GET] /market-overview with the Ibovespa trend and a one-day IFIX', async () => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    indices.histories.set(MarketIndexCode.IBOVESPA, {
      code: MarketIndexCode.IBOVESPA,
      source: 'Yahoo Finance (^BVSP)',
      closes: makeIndexCloses(today, 500, 130_000, 209_000),
    })
    // O que o Yahoo entrega de verdade para IFIX.SA: um único fechamento.
    indices.histories.set(MarketIndexCode.IFIX, {
      code: MarketIndexCode.IFIX,
      source: 'Yahoo Finance (IFIX.SA)',
      closes: makeIndexCloses(today, 1, 3988.54, 3988.54),
    })

    const response = await request(app.getHttpServer())
      .get('/market-overview')
      .set('Cookie', cookie)

    indices.histories.clear()

    expect(response.statusCode).toBe(200)

    const { overview } = response.body

    expect(overview.market.ibovespa).toMatchObject({
      source: 'Yahoo Finance (^BVSP)',
      trend: 'UP',
    })
    expect(overview.market.ibovespa.return12m).toMatch(/^\d+\.\d{2}$/)
    expect(overview.market.ibovespa.vsMovingAverage200).toMatch(
      /^-?\d+\.\d{2}$/
    )
    expect(overview.market.ifix).toBeNull()

    const alerts = overview.alerts.map((alert: { code: string }) => alert.code)

    expect(alerts).toEqual(['INDEX_UNAVAILABLE'])

    const readings: ReadingBody[] = overview.readings
    const stocks = readings.find((reading) => reading.topic === 'STOCKS')!

    // contexto de preço entra como motivo; o stance continua o dos juros
    expect(stocks.stance).toBe('NEUTRAL')
    expect(stocks.reasons.map((reason) => reason.code)).toContain(
      'INDEX_TREND_UP'
    )
  })

  test('[GET] /market-overview with exemptPercentOfCdi', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-overview?exemptPercentOfCdi=100')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.overview.equivalences[0].exemptPercentOfCdi).toBe(
      '100.00'
    )
    expect(
      response.body.overview.equivalences[0].brackets[3]
        .equivalentTaxedPercentOfCdi
    ).toBe('117.65')
  })

  test.each(['0', '-5', 'abc'])(
    '[GET] /market-overview with an invalid exemptPercentOfCdi (%s)',
    async (value) => {
      const response = await request(app.getHttpServer())
        .get(`/market-overview?exemptPercentOfCdi=${value}`)
        .set('Cookie', cookie)

      expect(response.statusCode).toBe(400)
    }
  )
})
