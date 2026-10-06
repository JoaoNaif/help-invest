import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { configureApp } from '@/infra/setup-app'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Get Current User (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    await request(app.getHttpServer()).post('/accounts').send({
      name: 'John Doe',
      email: 'john@example.com',
      password: '12345678',
    })
  })

  afterAll(async () => {
    await app.close()
  })

  test('[GET] /me', async () => {
    const login = await request(app.getHttpServer())
      .post('/sessions')
      .send({ email: 'john@example.com', password: '12345678' })

    const accessCookie = (login.get('Set-Cookie') ?? [])
      .find((cookie) => cookie.startsWith('access_token='))!
      .split(';')[0]

    const response = await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', accessCookie)

    expect(response.statusCode).toBe(200)
    expect(response.body.user).toEqual(
      expect.objectContaining({ name: 'John Doe', email: 'john@example.com' })
    )
    expect(response.body.user).not.toHaveProperty('passwordHash')
  })

  test('[GET] /me without token', async () => {
    const response = await request(app.getHttpServer()).get('/me')

    expect(response.statusCode).toBe(401)
  })
})
