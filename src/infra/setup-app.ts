import { INestApplication } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { EnvService } from './env/env.service'
import { originCheck } from './http/middlewares/origin-check.middleware'

/** Cobre uma imagem de 5 MB em base64 + o resto do corpo. */
const JSON_BODY_LIMIT = '8mb'

// Tudo que o app precisa além dos módulos. Fica aqui (e não no main.ts) para o
// mesmo setup poder ser usado nos testes e2e — senão CORS/helmet só existiriam
// no servidor real e nunca seriam testados.
export function configureApp(app: INestApplication) {
  const env = app.get(EnvService)

  // cabeçalhos de segurança (nosniff, sem X-Powered-By, HSTS, etc.)
  app.use(helmet())
  app.use(cookieParser())

  // O padrão do Express (100 kb) barra o print em base64 do UC-14.
  ;(app as NestExpressApplication).useBodyParser('json', {
    limit: JSON_BODY_LIMIT,
  })

  // Só as origens listadas podem chamar a API pelo navegador. credentials:true
  // porque a sessão vai em cookie (access_token).
  app.enableCors({
    origin: env.get('CORS_ORIGINS'),
    credentials: true,
  })

  // CSRF: barra POST/PUT/PATCH/DELETE vindos de origem fora da lista.
  app.use(originCheck(env.get('CORS_ORIGINS')))
}
