import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Logout (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    prisma = moduleRef.get(PrismaService)
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

  test('[DELETE] /sessions', async () => {
    const login = await request(app.getHttpServer())
      .post('/sessions')
      .send({ email: 'john@example.com', password: '12345678' })

    const refreshCookie = (login.get('Set-Cookie') ?? [])
      .find((cookie) => cookie.startsWith('refresh_token='))!
      .split(';')[0]

    const response = await request(app.getHttpServer())
      .delete('/sessions')
      .set('Cookie', refreshCookie)

    expect(response.statusCode).toBe(204)
    expect(response.get('Set-Cookie')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^access_token=;/),
        expect.stringMatching(/^refresh_token=;/),
      ])
    )

    const session = await prisma.session.findFirst()

    expect(session?.revokedAt).toBeInstanceOf(Date)

    // O refresh token revogado não serve mais.
    const refresh = await request(app.getHttpServer())
      .post('/sessions/refresh')
      .set('Cookie', refreshCookie)

    expect(refresh.statusCode).toBe(401)
  })

  test('[DELETE] /sessions without cookie', async () => {
    const response = await request(app.getHttpServer()).delete('/sessions')

    expect(response.statusCode).toBe(204)
  })
})
