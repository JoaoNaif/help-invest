import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { signIn } from 'test/e2e/sign-in'
import { FakeLlmGateway } from 'test/gateways/fake-llm-gateway'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

interface AlertBody {
  code: string
}

interface PathBody {
  assetClass: string
  direction: string
  gapPercentage: string
  reasons: { code: string }[]
  risks: { code: string }[]
}

describe('Portfolio analyses (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  // O LLM real custa dinheiro e não é determinístico: nos e2e vai um fake.
  const llm = new FakeLlmGateway()
  let cookie: string
  let otherCookie: string
  let emptyAnalysisId: string
  let analysisId: string

  // Selic/CDI de hoje, Selic de ~6 meses atrás e 12 meses de IPCA seguidos.
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
      .overrideProvider(LlmGateway)
      .useValue(llm)
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    prisma = moduleRef.get(PrismaService)
    await app.init()

    await seedIndicators()

    cookie = await signIn(app, 'portfolio-analyses@example.com')
    otherCookie = await signIn(app, 'other-portfolio-analyses@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[POST] /portfolio-analyses requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/portfolio-analyses')
      .send({ strategy: 'BALANCE' })

    expect(response.statusCode).toBe(401)
  })

  test('[POST] /portfolio-analyses with an unknown strategy', async () => {
    const response = await request(app.getHttpServer())
      .post('/portfolio-analyses')
      .set('Cookie', cookie)
      .send({ strategy: 'YOLO' })

    expect(response.statusCode).toBe(400)
  })

  test('[POST] /portfolio-analyses without positions or profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/portfolio-analyses')
      .set('Cookie', cookie)
      .send({ strategy: 'BALANCE' })

    expect(response.statusCode).toBe(201)

    const { analysis } = response.body

    expect(analysis.strategy).toBe('BALANCE')
    expect(analysis.explanation).toBeNull()
    expect(analysis.result.total).toBe('0.00')
    expect(analysis.result.profileUsed).toEqual({
      riskTolerance: 'MEDIUM',
      horizonMonths: 60,
      goal: null,
      isDefault: true,
    })
    expect(analysis.result.reserve).toBeNull()
    expect(analysis.result.market).toMatchObject({
      selic: '14.75',
      cdi: '14.65',
      ipca12m: '4.91',
      realRate: '9.38',
      selicTrend: 'FALLING',
    })
    expect(
      analysis.result.alerts.map((alert: AlertBody) => alert.code)
    ).toEqual(
      expect.arrayContaining([
        'PORTFOLIO_EMPTY',
        'PROFILE_MISSING',
        'NO_EQUITY_MARKET_DATA',
      ])
    )
    expect(
      analysis.assumptions.targetAllocation.rangesAreBandsNotExactAllocation
    ).toBe(true)

    emptyAnalysisId = analysis.id
  })

  test('[POST] /portfolio-analyses with a portfolio and a profile', async () => {
    await request(app.getHttpServer())
      .put('/investor-profile')
      .set('Cookie', cookie)
      .send({
        monthlyIncome: '10000',
        emergencyReserve: '20000',
        goal: 'GROWTH',
        horizonMonths: 120,
        riskTolerance: 'MEDIUM',
      })
      .expect(200)

    for (const position of [
      {
        assetType: 'CDB',
        name: 'CDB Banco A',
        investedAmount: '8000',
        indexer: 'CDI',
        rate: '110',
      },
      {
        assetType: 'TESOURO',
        name: 'Tesouro IPCA+',
        investedAmount: '1000',
        indexer: 'IPCA',
        rate: '6',
      },
      { assetType: 'ACAO', name: 'BBAS3', investedAmount: '1000' },
    ]) {
      await request(app.getHttpServer())
        .post('/positions')
        .set('Cookie', cookie)
        .send(position)
        .expect(201)
    }

    const response = await request(app.getHttpServer())
      .post('/portfolio-analyses')
      .set('Cookie', cookie)
      .send({ strategy: 'MAX_RETURN' })

    expect(response.statusCode).toBe(201)

    const { analysis } = response.body
    const { result } = analysis

    expect(result.total).toBe('10000.00')
    expect(result.profileUsed.isDefault).toBe(false)
    expect(result.profileUsed.riskTolerance).toBe('MEDIUM')
    expect(result.reserve).toEqual({
      recommended: '60000.00',
      current: '20000.00',
      gap: '40000.00',
      isBelowRecommended: true,
    })
    expect(result.current).toContainEqual({
      assetClass: 'FIXED_POST',
      amount: '8000.00',
      percentage: '80.00',
    })

    const paths: PathBody[] = result.paths
    const post = paths.find((path) => path.assetClass === 'FIXED_POST')!
    const stocks = paths.find((path) => path.assetClass === 'STOCKS')!
    const realEstate = paths.find(
      (path) => path.assetClass === 'REAL_ESTATE_FUNDS'
    )!

    // 80% contra faixa de 20% a 40%
    expect(post.direction).toBe('REDUCE')
    expect(post.gapPercentage).toBe('40.00')
    // maior desvio primeiro
    expect(paths[0].assetClass).toBe('FIXED_POST')
    // MAX_RETURN: piso de ações sobe para 17,5%; tem 10% → abaixo
    expect(stocks.direction).toBe('INCREASE')
    expect(realEstate.direction).toBe('INCREASE')
    // reserva baixa avisa nos caminhos de renda variável
    expect(stocks.risks.map((risk) => risk.code)).toContain(
      'LOW_RESERVE_FOR_STOCKS'
    )
    expect(result.alerts.map((alert: AlertBody) => alert.code)).toEqual(
      expect.arrayContaining(['LOW_EMERGENCY_RESERVE', 'NO_EQUITY_MARKET_DATA'])
    )
    expect(result.alerts.map((alert: AlertBody) => alert.code)).not.toContain(
      'PORTFOLIO_EMPTY'
    )

    analysisId = analysis.id
  })

  test('[GET] /portfolio-analyses/:id keeps the snapshot after the portfolio changes', async () => {
    const { body: positions } = await request(app.getHttpServer())
      .get('/positions')
      .set('Cookie', cookie)

    for (const position of positions.positions) {
      await request(app.getHttpServer())
        .delete(`/positions/${position.id}`)
        .set('Cookie', cookie)
    }

    const response = await request(app.getHttpServer())
      .get(`/portfolio-analyses/${analysisId}`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.analysis.id).toBe(analysisId)
    expect(response.body.analysis.strategy).toBe('MAX_RETURN')
    expect(response.body.analysis.result.total).toBe('10000.00')
    expect(response.body.analysis.explanation).toBeNull()
  })

  test('[GET] /portfolio-analyses/:id of another user', async () => {
    const response = await request(app.getHttpServer())
      .get(`/portfolio-analyses/${analysisId}`)
      .set('Cookie', otherCookie)

    expect(response.statusCode).toBe(403)
  })

  test('[GET] /portfolio-analyses/:id that does not exist', async () => {
    const response = await request(app.getHttpServer())
      .get('/portfolio-analyses/7b1f4f0e-6f5a-4a38-9a4b-0d5a1f6f0a11')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(404)
  })

  test('[GET] /portfolio-analyses/:id with an invalid id', async () => {
    const response = await request(app.getHttpServer())
      .get('/portfolio-analyses/not-a-uuid')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(400)
  })

  test('[GET] /portfolio-analyses lists newest first, per user, without the explanation', async () => {
    const response = await request(app.getHttpServer())
      .get('/portfolio-analyses?page=1')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)

    const ids = response.body.analyses.map(
      (analysis: { id: string }) => analysis.id
    )

    expect(ids).toEqual([analysisId, emptyAnalysisId])
    expect(response.body.analyses[0]).not.toHaveProperty('explanation')

    const other = await request(app.getHttpServer())
      .get('/portfolio-analyses')
      .set('Cookie', otherCookie)

    expect(other.body.analyses).toEqual([])
  })

  test('[GET] /portfolio-analyses with an invalid page', async () => {
    const response = await request(app.getHttpServer())
      .get('/portfolio-analyses?page=0')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(400)
  })

  test('[POST] /portfolio-analyses/:id/explanation', async () => {
    llm.portfolioExplanation = {
      summary: 'A carteira está concentrada em renda fixa pós-fixada.',
      highlights: [
        { assetClass: 'FIXED_POST', text: 'Acima da faixa-alvo.' },
        { assetClass: 'PETR4' as never, text: 'invenção' },
      ],
      attentionPoints: ['Reserva abaixo do recomendado.'],
    }

    const response = await request(app.getHttpServer())
      .post(`/portfolio-analyses/${analysisId}/explanation`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.explanation).toEqual({
      summary: 'A carteira está concentrada em renda fixa pós-fixada.',
      highlights: [{ assetClass: 'FIXED_POST', text: 'Acima da faixa-alvo.' }],
      attentionPoints: ['Reserva abaixo do recomendado.'],
    })

    const log = await prisma.llmLog.findFirst({
      where: { portfolioAnalysisId: analysisId },
    })

    expect(log?.purpose).toBe('PORTFOLIO_EXPLANATION')

    const get = await request(app.getHttpServer())
      .get(`/portfolio-analyses/${analysisId}`)
      .set('Cookie', cookie)

    expect(get.body.analysis.explanation.summary).toContain('concentrada')
  })

  test('[POST] /portfolio-analyses/:id/explanation of another user', async () => {
    const response = await request(app.getHttpServer())
      .post(`/portfolio-analyses/${analysisId}/explanation`)
      .set('Cookie', otherCookie)

    expect(response.statusCode).toBe(403)
  })

  test('[POST] /portfolio-analyses/:id/explanation that does not exist', async () => {
    const response = await request(app.getHttpServer())
      .post(
        '/portfolio-analyses/7b1f4f0e-6f5a-4a38-9a4b-0d5a1f6f0a11/explanation'
      )
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(404)
  })

  test('[POST] /portfolio-analyses/:id/explanation with the LLM down', async () => {
    llm.unavailable = true

    const response = await request(app.getHttpServer())
      .post(`/portfolio-analyses/${emptyAnalysisId}/explanation`)
      .set('Cookie', cookie)

    llm.unavailable = false

    expect(response.statusCode).toBe(503)
  })

  test('[POST] /portfolio-analyses/:id/explanation with an invalid answer', async () => {
    llm.portfolioExplanation = null

    const response = await request(app.getHttpServer())
      .post(`/portfolio-analyses/${emptyAnalysisId}/explanation`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(502)
  })
})
