import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { EnvModule } from './env/env.module'
import { EnvService } from './env/env.service'
import { DatabaseModule } from './database/database.module'
import { HttpModule } from './http/http.module'
import { AuthModule } from './auth/auth.module'
import { JobsModule } from './jobs/jobs.module'

@Module({
  imports: [
    EnvModule,
    // Limite geral por IP (folgado: só barra inundação). Login e cadastro terão
    // limites mais duros, definidos com @Throttle nos próprios controllers.
    ThrottlerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        skipIf: () => !env.get('RATE_LIMIT_ENABLED'),
      }),
    }),
    DatabaseModule,
    AuthModule,
    HttpModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
