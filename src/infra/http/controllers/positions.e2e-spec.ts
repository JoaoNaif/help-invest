import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { configureApp } from '@/infra/setup-app'
import { signIn } from 'test/e2e/sign-in'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Positions and portfolio summary (e2e)', () => {
  let app: INestApplication
  let cookie: string
  let otherCookie: string
  let positionId: string

  const body = {
    assetType: 'CDB',
    name: 'CDB Banco X 110% CDI',
    investedAmount: '10000.00',
    issuerName: 'Banco X',
    issuerCnpj: '12345678000199',
    indexer: 'CDI',
    rate: 110,
    maturityAt: '2027-12-31',
    liquidity: 'AT_MATURITY',
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    cookie = await signIn(app, 'positions@example.com')
    otherCookie = await signIn(app, 'other-positions@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[POST] /positions', async () => {
    const response = await request(app.getHttpServer())
      .post('/positions')
      .set('Cookie', cookie)
      .send(body)

    expect(response.statusCode).toBe(201)
    expect(response.body.position).toEqual(
      expect.objectContaining({
        name: body.name,
        investedAmount: '10000',
        rate: '110',
        maturityAt: '2027-12-31',
        source: 'MANUAL',
      })
    )

    positionId = response.body.position.id
  })

  test('[POST] /positions with invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/positions')
      .set('Cookie', cookie)
      .send({ ...body, investedAmount: '-1', issuerCnpj: '123' })

    expect(response.statusCode).toBe(400)
  })

  test('[GET] /positions', async () => {
    const response = await request(app.getHttpServer())
      .get('/positions')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.positions).toHaveLength(1)

    const others = await request(app.getHttpServer())
      .get('/positions')
      .set('Cookie', otherCookie)

    expect(others.body.positions).toHaveLength(0)
  })

  test('[PATCH] /positions/:id', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/positions/${positionId}`)
      .set('Cookie', cookie)
      .send({ name: 'CDB renomeado', maturityAt: null })

    expect(response.statusCode).toBe(200)
    expect(response.body.position.name).toBe('CDB renomeado')
    expect(response.body.position.maturityAt).toBeNull()
    // campo ausente não é alterado
    expect(response.body.position.rate).toBe('110')
  })

  test('[PATCH] /positions/:id of another user', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/positions/${positionId}`)
      .set('Cookie', otherCookie)
      .send({ name: 'invasão' })

    expect(response.statusCode).toBe(403)
  })

  test('[PATCH] /positions/:id with malformed id', async () => {
    const response = await request(app.getHttpServer())
      .patch('/positions/not-a-uuid')
      .set('Cookie', cookie)
      .send({})

    expect(response.statusCode).toBe(400)
  })

  test('[GET] /portfolio/summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/portfolio/summary')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.summary.total).toBe('10000')
    expect(response.body.summary.byAssetType).toEqual([
      { key: 'CDB', amount: '10000', percentage: '100' },
    ])
    expect(Array.isArray(response.body.summary.alerts)).toBe(true)
  })

  test('[DELETE] /positions/:id of another user', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/positions/${positionId}`)
      .set('Cookie', otherCookie)

    expect(response.statusCode).toBe(403)
  })

  test('[DELETE] /positions/:id', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/positions/${positionId}`)
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(204)

    const again = await request(app.getHttpServer())
      .delete(`/positions/${positionId}`)
      .set('Cookie', cookie)

    expect(again.statusCode).toBe(404)
  })

  test('[GET] /positions without token', async () => {
    const response = await request(app.getHttpServer()).get('/positions')

    expect(response.statusCode).toBe(401)
  })
})
