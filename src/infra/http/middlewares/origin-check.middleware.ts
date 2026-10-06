import { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Proteção CSRF por checagem de origem. Navegadores sempre mandam `Origin` em
 * requisições que mudam estado; se ela vier e não for uma origem liberada no
 * CORS, a requisição é barrada antes de chegar ao controller.
 *
 * Sem `Origin` (curl, Postman, supertest) passa: não há navegador carregando
 * cookies de outra aba, então não existe CSRF.
 */
export function originCheck(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    if (SAFE_METHODS.has(req.method) || !origin) {
      return next()
    }

    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({
        message: 'Origin not allowed.',
        error: 'Forbidden',
        statusCode: 403,
      })
    }

    return next()
  }
}
