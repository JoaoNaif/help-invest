import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import Decimal from 'decimal.js'
import request from 'supertest'
import { StockDataProvider } from '@/domain/stock-analysis/applications/gateways/stock-data-provider'
import { AppModule } from '@/infra/app.module'
import { configureApp } from '@/infra/setup-app'
import { signIn } from 'test/e2e/sign-in'
import { makeStockSnapshot } from 'test/factories/make-stock-snapshot'
import { FakeStockDataProvider } from 'test/gateways/fake-stock-data-provider'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Stock analyses (e2e)', () => {
  let app: INestApplication
  // A fonte real (Yahoo) é de terceiros e instável: nos e2e vai um fake.
  const stockData = new FakeStockDataProvider()
  let cookie: string
  let otherCookie: string
  let analysisId: string

  beforeAll(async () => {
    for (const ticker of ['BBAS3', 'ITUB4', 'BBDC4', 'SANB11']) {
      stockData.snapshots.set(
        ticker,
        makeStockSnapshot({
          ticker,
          // preço de hoje, para não disparar o alerta de cotação velha
          priceDate: new Date(),
          price: new Decimal('25'),
        })
      )
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StockDataProvider)
      .useValue(stockData)
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    cookie = await signIn(app, 'stock-analyses@example.com')
    otherCookie = await signIn(app, 'other-stock-analyses@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[POST] /stock-analyses requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/stock-analyses')
      .send({ items: [{ ticker: 'BBAS3' }] })

    expect(response.statusCode).toBe(401)
  })

  test('[POST] /stock-analyses (single stock)', async () => {
    const response = await request(app.getHttpServer())
      .post('/stock-analyses')
      .set('Cookie', cookie)
      .send({ items: [{ ticker: 'bbas3', amount: '5000' }] })

    expect(response.statusCode).toBe(201)

    const { analysis } = response.body
    const [item] = analysis.result.items

    expect(analysis.tickers).toEqual(['BBAS3'])
    expect(item.plannedAmount).toBe('5000.00')
    expect(item.price).toBe('25.00')
    expect(item.dividends.trailing12mYield).toBe('8.00')
    expect(item.dividends.dateKind).toBe('EX')
    expect(item.ceilingPrices[0]).toEqual({
      method: 'BAZIN',
      value: '33.33',
      upsidePercent: '33.33',
    })
    expect(item.valuation.group).toBe('bancos')
    expect(item.valuation.peers).toHaveLength(3)
    expect(item.consensus.analystCount).toBe(13)
    // sem perfil preenchido
    expect(
      analysis.result.alerts.map((a: { code: string }) => a.code)
    ).toContain('PROFILE_MISSING')
    expect(analysis.assumptions.dividendsAreGross).toBe(true)

    analysisId = analysis.id
  })

  test('[POST] /stock-analyses (two stocks of the same sector)', async () => {
    const response = await request(app.getHttpServer())
      .post('/stock-analyses')
      .set('Cookie', cookie)
      .send({ items: [{ ticker: 'BBAS3' }, { ticker: 'ITUB4' }] })

    expect(response.statusCode).toBe(201)
    expect(response.body.analysis.result.items).toHaveLength(2)
    expect(
      response.body.analysis.result.alerts.map((a: { code: string }) => a.code)
    ).toContain('SAME_SECTOR')
  })

  test('[POST] /stock-analyses with an unknown ticker', async () => {
    const response = await request(app.getHttpServer())
      .post('/stock-analyses')
      .set('Cookie', cookie)
      .send({ items: [{ ticker: 'ZZZZ3' }] })

    expect(response.statusCode).toBe(404)
  })

  test('[POST] /stock-analyses when the data source is down', async () => {
    stockData.failing.add('BBDC4')

    const response = await request(app.getHttpServer())
      .post('/stock-analyses')
      .set('Cookie', cookie)
      .send({ items: [{ ticker: 'BBDC4' }] })

    stockData.failing.delete('BBDC4')

    expect(response.statusCode).toBe(503)
  })

  test('[POST] /stock-analyses with invalid bodies', async () => {
    const send = (body: unknown) =>
      request(app.getHttpServer())
        .post('/stock-analyses')
        .set('Cookie', cookie)
        .send(body as object)

    // forma inválida → 400 (Zod)
    expect((await send({ items: [] })).statusCode).toBe(400)
    expect(
      (
        await send({
          items: [
            { ticker: 'BBAS3' },
            { ticker: 'ITUB4' },
            { ticker: 'BBDC4' },
          ],
        })
      ).statusCode
    ).toBe(400)
    expect(
      (await send({ items: [{ ticker: 'BBAS3', amount: '-10' }] })).statusCode
    ).toBe(400)
    // regra de negócio → 422
    expect(
      (await send({ items: [{ ticker: 'BBAS3' }, { ticker: 'bbas3' }] }))
        .statusCode
    ).toBe(422)
  })

  test('[GET] /stock-analyses/:id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/stock-analyses/${analysisId}`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.analysis.id).toBe(analysisId)
    expect(response.body.analysis.result.items[0].ticker).toBe('BBAS3')
  })

  test('[GET] /stock-analyses/:id of another user', async () => {
    const response = await request(app.getHttpServer())
      .get(`/stock-analyses/${analysisId}`)
      .set('Cookie', otherCookie)

    expect(response.statusCode).toBe(403)
  })

  test('[GET] /stock-analyses/:id that does not exist', async () => {
    const missing = await request(app.getHttpServer())
      .get('/stock-analyses/6f1f9b2a-3c3e-4e0e-9a55-0d6f4a1b2c3d')
      .set('Cookie', cookie)
    const malformed = await request(app.getHttpServer())
      .get('/stock-analyses/not-a-uuid')
      .set('Cookie', cookie)

    expect(missing.statusCode).toBe(404)
    expect(malformed.statusCode).toBe(400)
  })

  test('[GET] /stock-analyses lists only the analyses of the user', async () => {
    const mine = await request(app.getHttpServer())
      .get('/stock-analyses')
      .set('Cookie', cookie)
    const others = await request(app.getHttpServer())
      .get('/stock-analyses')
      .set('Cookie', otherCookie)

    expect(mine.statusCode).toBe(200)
    expect(mine.body.analyses).toHaveLength(2)
    // mais recente primeiro: a de duas ações foi criada depois
    expect(mine.body.analyses[0].tickers).toEqual(['BBAS3', 'ITUB4'])
    expect(others.body.analyses).toEqual([])
  })
})
