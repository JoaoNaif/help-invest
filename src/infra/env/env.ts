import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3333),

  DATABASE_URL: z.string().url(),

  // Origens do front que podem chamar a API (CORS), separadas por vírgula.
  // Padrão: só localhost (portas do Next e do Vite).
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),

  // Limite de requisições por IP (login e cadastro terão limites mais duros).
  // z.coerce.boolean() não serve: 'false' é string não-vazia, viraria true.
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  JWT_PRIVATE_KEY: z.string(),
  JWT_PUBLIC_KEY: z.string(),
  // Validade do access token. Curta de propósito: a sessão longa vem do refresh token.
  JWT_EXPIRES_IN: z.string().default('15m'),
})

export type Env = z.infer<typeof envSchema>
