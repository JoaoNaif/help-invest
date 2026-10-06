import { Controller, Delete, HttpCode, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { LogoutUseCase } from '@/domain/accounts/applications/use-cases/logout'
import { Public } from '@/infra/auth/public'
import { EnvService } from '@/infra/env/env.service'
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from '../auth-cookies'

/**
 * UC-04 — DELETE /sessions. Pública: o logout precisa funcionar mesmo com o
 * access token já expirado. Idempotente: sem cookie também responde 204.
 */
@Controller('sessions')
@Public()
export class LogoutController {
  constructor(
    private logout: LogoutUseCase,
    private env: EnvService
  ) {}

  @Delete()
  @HttpCode(204)
  async handle(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE]

    if (typeof refreshToken === 'string' && refreshToken) {
      await this.logout.execute({ refreshToken })
    }

    clearAuthCookies(res, this.env.get('NODE_ENV') === 'production')
  }
}
