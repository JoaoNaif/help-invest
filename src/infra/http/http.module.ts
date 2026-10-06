import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { CryptographyModule } from '../cryptography/cryptography.module'
import { EnvModule } from '../env/env.module'
import { AuthenticateController } from './controllers/authenticate.controller'
import { GetCurrentUserController } from './controllers/get-current-user.controller'
import { HealthController } from './controllers/health.controller'
import { LogoutController } from './controllers/logout.controller'
import { RefreshSessionController } from './controllers/refresh-session.controller'
import { RegisterUserController } from './controllers/register-user.controller'
import { accountsUseCases } from './use-cases/accounts.providers'

// Controllers e use-cases (providers) de cada contexto entram aqui.
@Module({
  imports: [DatabaseModule, CryptographyModule, EnvModule],
  controllers: [
    HealthController,
    RegisterUserController,
    AuthenticateController,
    RefreshSessionController,
    LogoutController,
    GetCurrentUserController,
  ],
  providers: [...accountsUseCases],
})
export class HttpModule {}
