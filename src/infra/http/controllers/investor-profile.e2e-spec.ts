import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { configureApp } from '@/infra/setup-app'
import { signIn } from 'test/e2e/sign-in'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Investor profile (e2e)', () => {
  let app: INestApplication
  let cookie: string

  const body = {
    monthlyIncome: '8000.50',
    emergencyReserve: 20000,
    goal: 'RESERVE',
    horizonMonths: 12,
    riskTolerance: 'LOW',
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    cookie = await signIn(app, 'profile@example.com')
  })

  afterAll(async () => {
    await app.close()
  })

  test('[GET] /investor-profile before filling it', async () => {
    const response = await request(app.getHttpServer())
      .get('/investor-profile')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(404)
  })

  test('[PUT] /investor-profile creates and then updates', async () => {
    const created = await request(app.getHttpServer())
      .put('/investor-profile')
      .set('Cookie', cookie)
      .send(body)

    expect(created.statusCode).toBe(200)
    expect(created.body.profile).toEqual(
      expect.objectContaining({
        monthlyIncome: '8000.5',
        emergencyReserve: '20000',
        goal: 'RESERVE',
      })
    )

    const updated = await request(app.getHttpServer())
      .put('/investor-profile')
      .set('Cookie', cookie)
      .send({ ...body, goal: 'GROWTH', riskTolerance: 'HIGH' })

    expect(updated.statusCode).toBe(200)
    expect(updated.body.profile.id).toBe(created.body.profile.id)
    expect(updated.body.profile.goal).toBe('GROWTH')
  })

  test('[GET] /investor-profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/investor-profile')
      .set('Cookie', cookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.profile.riskTolerance).toBe('HIGH')
    expect(response.body.isOutdated).toBe(false)
  })

  test('[PUT] /investor-profile with invalid body', async () => {
    const response = await request(app.getHttpServer())
      .put('/investor-profile')
      .set('Cookie', cookie)
      .send({ ...body, horizonMonths: 0, monthlyIncome: 'abc' })

    expect(response.statusCode).toBe(400)
  })

  test('[PUT] /investor-profile without token', async () => {
    const response = await request(app.getHttpServer())
      .put('/investor-profile')
      .send(body)

    expect(response.statusCode).toBe(401)
  })
})
