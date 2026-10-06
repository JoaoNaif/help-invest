import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Request } from 'express'
import { z } from 'zod'
import { EnvService } from '../env/env.service'

export const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
})

export type UserPayload = z.infer<typeof tokenPayloadSchema>

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: EnvService) {
    const publicKey = config.get('JWT_PUBLIC_KEY')

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primeiro tenta extrair do cookie httpOnly (mais seguro)
        (request: Request) => request?.cookies?.access_token,
        // Fallback para o header Authorization (testes, Postman)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: Buffer.from(publicKey, 'base64'),
      algorithms: ['RS256'],
    })
  }

  // Só chega aqui com assinatura e validade já conferidas.
  async validate(payload: unknown): Promise<UserPayload> {
    const parsed = tokenPayloadSchema.safeParse(payload)

    if (!parsed.success) throw new UnauthorizedException()

    return parsed.data
  }
}
