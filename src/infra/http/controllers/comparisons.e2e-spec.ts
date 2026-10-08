import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import Decimal from 'decimal.js'
import { LlmGateway } from '@/domain/comparison/applications/gateways/llm-gateway'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { FakeLlmGateway } from 'test/gateways/fake-llm-gateway'
import { signIn } from 'test/e2e/sign-in'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Comparisons (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  // O LLM real custa dinheiro e não é determinístico: nos e2e vai um fake.
  const llm = new FakeLlmGateway()
  let cookie: string
  let otherCookie: string
  let comparisonId: string
  let optionIds: string[]

  const option = (rate: number, issuerName: string) => ({
    assetType: 'CDB',
    indexer: 'CDI',
    rate,
    issuerName,
    maturityAt: '2028-01-31',
    liquidity: 'AT_MATURITY',
  })

  const body = {
    amount: '5000',
    horizonMonths: 24,
    input: {
      type: 'manual',
      options: [option(100, 'Banco A'), option(115, 'Banco B')],
    },
  }

  // Dados de mercado que o motor exige (CDI/Selic recentes, 12 meses de IPCA).
  async function seedIndicators() {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today)
      date.setUTCMonth(date.getUTCMonth() - index - 1, 1)
      return date
    })

    await prisma.indicatorValue.createMany({
      data: [
        { indicator: 'CDI', date: today, value: '14.9', source: 'test' },
        { indicator: 'SELIC', date: today, value: '15', source: 'test' },
        ...monthly.map((date) => ({
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

    cookie = await signIn(app, 'comparisons@example.com')
    otherCookie = await signIn(app, 'other-comparisons@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[POST] /comparisons (manual)', async () => {
    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send(body)

    expect(response.statusCode).toBe(201)
    expect(response.body.comparison).toEqual(
      expect.objectContaining({ status: 'DRAFT', amount: '5000' })
    )
    expect(response.body.options).toHaveLength(2)
    expect(response.body.options[0].netAnnualRate).toBeNull()
    // sem objetivo informado
    expect(response.body.comparison.goal).toBeNull()

    comparisonId = response.body.comparison.id
  })

  test('[POST] /comparisons with a goal', async () => {
    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({ ...body, goal: 'PURCHASE' })

    expect(response.statusCode).toBe(201)
    expect(response.body.comparison.goal).toBe('PURCHASE')

    const detail = await request(app.getHttpServer())
      .get(`/comparisons/${response.body.comparison.id}`)
      .set('Cookie', cookie)

    expect(detail.body.comparison.goal).toBe('PURCHASE')
  })

  test('[POST] /comparisons with an invalid goal', async () => {
    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({ ...body, goal: 'GET_RICH' })

    expect(response.statusCode).toBe(400)
  })

  test('[POST] /comparisons by text', async () => {
    llm.extractedOptions = [
      {
        assetType: 'CDB',
        indexer: 'CDI',
        rate: new Decimal(110),
        issuerName: 'Banco LLM',
      },
    ]

    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({ ...body, input: { type: 'text', text: 'CDB 110% CDI' } })

    expect(response.statusCode).toBe(201)
    expect(response.body.options[0]).toEqual(
      expect.objectContaining({ source: 'LLM_EXTRACTED', rate: '110' })
    )
  })

  test('[POST] /comparisons by image accepts a body larger than 100kb', async () => {
    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({
        ...body,
        input: {
          type: 'image',
          base64: 'A'.repeat(300_000),
          mediaType: 'image/png',
        },
      })

    expect(response.statusCode).toBe(201)
  })

  test('[POST] /comparisons when the LLM is unavailable', async () => {
    llm.unavailable = true

    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({ ...body, input: { type: 'text', text: 'CDB 110% CDI' } })

    llm.unavailable = false

    expect(response.statusCode).toBe(503)
  })

  test('[POST] /comparisons with invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/comparisons')
      .set('Cookie', cookie)
      .send({ ...body, input: { type: 'manual', options: [] } })

    expect(response.statusCode).toBe(400)
  })

  test('[GET] /comparisons/:id of another user', async () => {
    const response = await request(app.getHttpServer())
      .get(`/comparisons/${comparisonId}`)
      .set('Cookie', otherCookie)

    expect(response.statusCode).toBe(403)
  })

  test('[PUT] /comparisons/:id/options', async () => {
    const current = await request(app.getHttpServer())
      .get(`/comparisons/${comparisonId}`)
      .set('Cookie', cookie)

    const [first] = current.body.options

    const response = await request(app.getHttpServer())
      .put(`/comparisons/${comparisonId}/options`)
      .set('Cookie', cookie)
      .send({
        // mantém a primeira (corrigindo a taxa), remove a segunda, cria uma nova
        options: [
          { ...option(105, 'Banco A'), id: first.id },
          option(120, 'Banco C'),
        ],
      })

    expect(response.statusCode).toBe(200)
    expect(response.body.options).toHaveLength(2)
    expect(response.body.options.map((item: { rate: string }) => item.rate))
      .toEqual(['105', '120'])
    expect(response.body.options[1].source).toBe('MANUAL')
  })

  test('[POST] /comparisons/:id/explanation before evaluating', async () => {
    const response = await request(app.getHttpServer())
      .post(`/comparisons/${comparisonId}/explanation`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(409)
  })

  test('[POST] /comparisons/:id/evaluate without indicators', async () => {
    const response = await request(app.getHttpServer())
      .post(`/comparisons/${comparisonId}/evaluate`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(503)
  })

  test('[POST] /comparisons/:id/evaluate', async () => {
    await seedIndicators()

    const response = await request(app.getHttpServer())
      .post(`/comparisons/${comparisonId}/evaluate`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.comparison.status).toBe('DONE')
    expect(response.body.comparison.assumptions).not.toBeNull()
    expect(response.body.options).toHaveLength(2)

    for (const item of response.body.options) {
      expect(item.netAnnualRate).not.toBeNull()
      expect(Array.isArray(item.alerts)).toBe(true)
    }

    optionIds = response.body.options.map((item: { id: string }) => item.id)
  })

  test('[PUT] /comparisons/:id/options after evaluating', async () => {
    const response = await request(app.getHttpServer())
      .put(`/comparisons/${comparisonId}/options`)
      .set('Cookie', cookie)
      .send({ options: [option(100, 'Banco A')] })

    expect(response.statusCode).toBe(409)
  })

  test('[POST] /comparisons/:id/explanation', async () => {
    llm.explanation = {
      summary: 'A opção 1 rende mais líquido.',
      bestOptionId: optionIds[0],
      bestReason: 'Combina com o objetivo.',
      options: [
        { optionId: optionIds[0], pros: ['Taxa maior'], cons: ['Prazo longo'] },
        // id que o LLM inventou: o backend descarta
        { optionId: '00000000-0000-4000-8000-000000000000', pros: [], cons: [] },
      ],
    }

    const response = await request(app.getHttpServer())
      .post(`/comparisons/${comparisonId}/explanation`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.explanation).toEqual({
      ...llm.explanation,
      options: [llm.explanation!.options[0]],
    })
    expect(llm.explainCalls[0].options[0].optionId).toBe(optionIds[0])
    // o motor já calculou: o LLM recebe os números prontos
    expect(llm.explainCalls[0].options[0].netAnnualRate).toMatch(/^\d/)
  })

  test('[PUT] /comparisons/:id/chosen-option', async () => {
    const response = await request(app.getHttpServer())
      .put(`/comparisons/${comparisonId}/chosen-option`)
      .set('Cookie', cookie)
      .send({ optionId: optionIds[0] })

    expect(response.statusCode).toBe(200)
    expect(response.body.comparison.chosenOptionId).toBe(optionIds[0])

    const changed = await request(app.getHttpServer())
      .put(`/comparisons/${comparisonId}/chosen-option`)
      .set('Cookie', cookie)
      .send({ optionId: optionIds[1] })

    expect(changed.body.comparison.chosenOptionId).toBe(optionIds[1])
  })

  test('[PUT] /comparisons/:id/chosen-option with unknown option', async () => {
    const response = await request(app.getHttpServer())
      .put(`/comparisons/${comparisonId}/chosen-option`)
      .set('Cookie', cookie)
      .send({ optionId: '00000000-0000-4000-8000-000000000000' })

    expect(response.statusCode).toBe(404)
  })

  test('[GET] /comparisons/:id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/comparisons/${comparisonId}`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.comparison.chosenOptionId).toBe(optionIds[1])
    // a última explicação gerada volta no detalhe, já saneada
    expect(response.body.explanation.bestOptionId).toBe(optionIds[0])
    expect(response.body.explanation.options).toHaveLength(1)

    // avaliada: da maior para a menor taxa líquida
    const [best, worst] = response.body.options.map(
      (item: { netAnnualRate: string }) => Number(item.netAnnualRate)
    )
    expect(best).toBeGreaterThanOrEqual(worst)
  })

  test('[GET] /comparisons', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparisons')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.comparisons).toHaveLength(4)
    expect(response.body.comparisons[0]).not.toHaveProperty('options')

    const evaluated = response.body.comparisons.find(
      (item: { id: string }) => item.id === comparisonId
    )
    expect(evaluated.optionsCount).toBe(2)
    expect(evaluated.topOption).toEqual({
      issuerName: expect.any(String),
      assetType: 'CDB',
      netAnnualRate: expect.stringMatching(/^\d/),
    })

    // rascunho: tem opções, mas ainda não há "melhor"
    const draft = response.body.comparisons.find(
      (item: { status: string }) => item.status === 'DRAFT'
    )
    expect(draft.optionsCount).toBeGreaterThan(0)
    expect(draft.topOption).toBeNull()

    const others = await request(app.getHttpServer())
      .get('/comparisons?page=1')
      .set('Cookie', otherCookie)

    expect(others.body.comparisons).toHaveLength(0)
  })

  test('[GET] /comparison-options/recent', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparison-options/recent')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.options.length).toBeGreaterThan(0)

    // só dados de entrada: nada de id, resultado do motor nem origem
    for (const option of response.body.options) {
      expect(Object.keys(option).sort()).toEqual(
        [
          'assetType',
          'graceDays',
          'indexer',
          'issuerCnpj',
          'issuerName',
          'liquidity',
          'maturityAt',
          'minAmount',
          'rate',
        ].sort()
      )
    }

    // sem repetir a mesma opção (Banco A 100% CDI aparece em mais de uma comparação)
    const keys = response.body.options.map(
      (option: { issuerName: string; rate: string }) =>
        `${option.issuerName}|${option.rate}`
    )
    expect(new Set(keys).size).toBe(keys.length)

    const others = await request(app.getHttpServer())
      .get('/comparison-options/recent')
      .set('Cookie', otherCookie)

    expect(others.body.options).toEqual([])
  })

  test('[GET] /comparison-options/recent without token', async () => {
    const response = await request(app.getHttpServer()).get(
      '/comparison-options/recent'
    )

    expect(response.statusCode).toBe(401)
  })

  test('[GET] /comparisons with invalid page', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparisons?page=0')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(400)
  })

  test('[GET] /comparisons without token', async () => {
    const response = await request(app.getHttpServer()).get('/comparisons')

    expect(response.statusCode).toBe(401)
  })
})
