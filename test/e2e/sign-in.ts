import { INestApplication } from '@nestjs/common'
import request from 'supertest'

/** Cadastra e loga um usuário; devolve o cookie `access_token` para os testes. */
export async function signIn(app: INestApplication, email: string) {
  const credentials = { email, password: '12345678' }

  await request(app.getHttpServer())
    .post('/accounts')
    .send({ name: 'John Doe', ...credentials })

  const login = await request(app.getHttpServer())
    .post('/sessions')
    .send(credentials)

  return (login.get('Set-Cookie') ?? [])
    .find((cookie) => cookie.startsWith('access_token='))!
    .split(';')[0]
}
