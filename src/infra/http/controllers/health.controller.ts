import { Controller, Get } from '@nestjs/common'
import { Public } from '@/infra/auth/public'

/**
 * Placeholder de infraestrutura só para confirmar que o app sobe.
 * Pode virar um health check "de verdade" (ping no Postgres) depois.
 */
@Controller('health')
@Public()
export class HealthController {
  @Get()
  handle() {
    return { status: 'ok' }
  }
}
