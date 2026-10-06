import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Response } from 'express'
import { z } from 'zod'
import { WrongCredentialsError } from '@/domain/accounts/applications/errors/wrong-credentials-error'
import { AuthenticateUseCase } from '@/domain/accounts/applications/use-cases/authenticate'
import { Public } from '@/infra/auth/public'
import { EnvService } from '@/infra/env/env.service'
import { setAuthCookies } from '../auth-cookies'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'

const authenticateBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

type AuthenticateBodySchema = z.infer<typeof authenticateBodySchema>

/** UC-02 — POST /sessions. Os tokens saem só em cookies httpOnly. */
@Controller('sessions')
@Public()
export class AuthenticateController {
  constructor(
    private authenticate: AuthenticateUseCase,
    private env: EnvService
  ) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async handle(
    @Body(new ZodValidationPipe(authenticateBodySchema))
    body: AuthenticateBodySchema,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authenticate.execute({
      ...body,
      userAgent: userAgent ?? null,
    })

    if (result.isLeft()) {
      const error = result.value

      switch (error.constructor) {
        case WrongCredentialsError:
          throw new UnauthorizedException(error.message)
        default:
          throw new BadRequestException(error.message)
      }
    }

    setAuthCookies(res, result.value, this.env.get('NODE_ENV') === 'production')
  }
}
