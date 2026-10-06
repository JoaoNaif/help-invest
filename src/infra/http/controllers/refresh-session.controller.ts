import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Request, Response } from 'express'
import { RefreshSessionUseCase } from '@/domain/accounts/applications/use-cases/refresh-session'
import { Public } from '@/infra/auth/public'
import { EnvService } from '@/infra/env/env.service'
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '../auth-cookies'

/** UC-03 — POST /sessions/refresh. Lê o refresh token do cookie e o rotaciona. */
@Controller('sessions/refresh')
@Public()
export class RefreshSessionController {
  constructor(
    private refreshSession: RefreshSessionUseCase,
    private env: EnvService
  ) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async handle(
    @Req() req: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const secure = this.env.get('NODE_ENV') === 'production'
    const refreshToken: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE]

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Refresh token missing.')
    }

    const result = await this.refreshSession.execute({
      refreshToken,
      userAgent: userAgent ?? null,
    })

    // Só existe InvalidSessionError: o cookie não serve mais, então sai.
    if (result.isLeft()) {
      clearAuthCookies(res, secure)
      throw new UnauthorizedException(result.value.message)
    }

    setAuthCookies(res, result.value, secure)
  }
}
