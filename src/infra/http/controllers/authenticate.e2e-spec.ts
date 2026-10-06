import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Authenticate (e2e)', () => {
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

  test('[POST] /sessions', async () => {
    const response = await request(app.getHttpServer())
      .post('/sessions')
      .set('User-Agent', 'e2e-agent')
      .send({ email: 'john@example.com', password: '12345678' })

    expect(response.statusCode).toBe(204)

    const cookies = response.get('Set-Cookie') ?? []

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^access_token=.+HttpOnly; SameSite=Strict/),
        expect.stringMatching(
          /^refresh_token=.+Path=\/sessions;.+HttpOnly; SameSite=Strict/
        ),
      ])
    )

    const sessions = await prisma.session.findMany()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].userAgent).toEqual('e2e-agent')
  })

  test('[POST] /sessions with wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/sessions')
      .send({ email: 'john@example.com', password: 'wrong-password' })

    expect(response.statusCode).toBe(401)
    expect(response.get('Set-Cookie')).toBeUndefined()
  })
})
