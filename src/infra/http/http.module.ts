import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { CryptographyModule } from '../cryptography/cryptography.module'
import { EnvModule } from '../env/env.module'
import { HealthController } from './controllers/health.controller'

// Controllers e use-cases (providers) de cada contexto entram aqui.
@Module({
  imports: [DatabaseModule, CryptographyModule, EnvModule],
  controllers: [HealthController],
  providers: [],
})
export class HttpModule {}
