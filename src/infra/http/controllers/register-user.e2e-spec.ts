import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '@/infra/app.module'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { configureApp } from '@/infra/setup-app'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('Register User (e2e)', () => {
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
  })

  afterAll(async () => {
    await app.close()
  })

  test('[POST] /accounts', async () => {
    const response = await request(app.getHttpServer()).post('/accounts').send({
      name: 'John Doe',
      email: 'John@Example.com',
      password: '12345678',
    })

    expect(response.statusCode).toBe(201)
    expect(response.body.user).toEqual({
      id: expect.any(String),
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: expect.any(String),
    })
    expect(response.body.user).not.toHaveProperty('passwordHash')

    const userOnDatabase = await prisma.user.findUnique({
      where: { email: 'john@example.com' },
    })

    expect(userOnDatabase).toBeTruthy()
    expect(userOnDatabase?.passwordHash).not.toEqual('12345678')
  })

  test('[POST] /accounts with an e-mail already in use', async () => {
    const response = await request(app.getHttpServer()).post('/accounts').send({
      name: 'John Again',
      email: 'john@example.com',
      password: '12345678',
    })

    expect(response.statusCode).toBe(409)
  })

  test('[POST] /accounts with an invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts')
      .send({ name: '', email: 'not-an-email', password: '123' })

    expect(response.statusCode).toBe(400)
  })

  test('[POST] /accounts from a foreign origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/accounts')
      .set('Origin', 'https://evil.example')
      .send({
        name: 'Mallory',
        email: 'mallory@example.com',
        password: '12345678',
      })

    expect(response.statusCode).toBe(403)
  })
})
