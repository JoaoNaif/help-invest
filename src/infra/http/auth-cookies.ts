import { CookieOptions, Response } from 'express'
import { SESSION_DURATION_DAYS } from '@/domain/accounts/entities/session'

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

// O refresh token só é enviado às rotas de sessão (refresh e logout); nas
// demais requisições ele nem sai do navegador.
const REFRESH_TOKEN_PATH = '/sessions'

const DAY_IN_MS = 24 * 60 * 60 * 1000

// SameSite=Strict é a primeira barreira contra CSRF; a segunda é a checagem de
// Origin (ver origin-check.middleware.ts). Secure só fora de dev/test, porque
// localhost roda em http.
function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict' }
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean
) {
  // Sem maxAge: a validade real do access token está no próprio JWT.
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(secure),
    path: '/',
  })

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_TOKEN_PATH,
    maxAge: SESSION_DURATION_DAYS * DAY_IN_MS,
  })
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(secure), path: '/' })
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseOptions(secure),
    path: REFRESH_TOKEN_PATH,
  })
}
