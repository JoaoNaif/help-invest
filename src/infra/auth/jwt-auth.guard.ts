import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from './public'

// Guard global: toda rota exige JWT, a menos que esteja marcada com @Public().
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      try {
        await super.canActivate(context)
      } catch {
        // Em rotas públicas, ignora erro de autenticação
      }
      return true
    }

    return super.canActivate(context) as Promise<boolean>
  }
}
