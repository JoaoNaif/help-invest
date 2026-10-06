import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

function getCookie(cookies: string[], name: string) {
  return cookies.find((cookie) => cookie.startsWith(`${name}=`))
}

describe('Refresh Session (e2e)', () => {
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

  test('[POST] /sessions/refresh', async () => {
    const login = await request(app.getHttpServer())
      .post('/sessions')
      .send({ email: 'john@example.com', password: '12345678' })

    const oldRefresh = getCookie(login.get('Set-Cookie') ?? [], 'refresh_token')

    const response = await request(app.getHttpServer())
      .post('/sessions/refresh')
      .set('Cookie', oldRefresh!.split(';')[0])

    expect(response.statusCode).toBe(204)

    const cookies = response.get('Set-Cookie') ?? []
    const newRefresh = getCookie(cookies, 'refresh_token')

    expect(getCookie(cookies, 'access_token')).toBeTruthy()
    expect(newRefresh).toBeTruthy()
    expect(newRefresh!.split(';')[0]).not.toEqual(oldRefresh!.split(';')[0])

    // Rotação: a sessão antiga foi revogada e uma nova criada.
    const sessions = await prisma.session.findMany()

    expect(sessions).toHaveLength(2)
    expect(sessions.filter((session) => session.revokedAt)).toHaveLength(1)
  })

  test('[POST] /sessions/refresh reusing a rotated token', async () => {
    const login = await request(app.getHttpServer())
      .post('/sessions')
      .send({ email: 'john@example.com', password: '12345678' })

    const firstRefresh = getCookie(
      login.get('Set-Cookie') ?? [],
      'refresh_token'
    )!.split(';')[0]

    await request(app.getHttpServer())
      .post('/sessions/refresh')
      .set('Cookie', firstRefresh)

    const response = await request(app.getHttpServer())
      .post('/sessions/refresh')
      .set('Cookie', firstRefresh)

    expect(response.statusCode).toBe(401)

    // Reuso = possível roubo: todas as sessões do usuário caem.
    const activeSessions = await prisma.session.count({
      where: { revokedAt: null },
    })

    expect(activeSessions).toBe(0)
  })

  test('[POST] /sessions/refresh without cookie', async () => {
    const response = await request(app.getHttpServer()).post(
      '/sessions/refresh'
    )

    expect(response.statusCode).toBe(401)
  })
})
