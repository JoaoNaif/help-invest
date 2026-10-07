import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { MarketDataProvider } from '@/domain/market-data/applications/gateways/market-data-provider'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { SyncIndicatorsUseCase } from '@/domain/market-data/applications/use-cases/sync-indicators'
import { DatabaseModule } from '../database/database.module'
import { BcbMarketDataProvider } from '../gateways/bcb-market-data-provider'
import { IndicatorsSyncJob } from './indicators-sync.job'

// Tarefas agendadas (cron). O UC-13 não tem controller: roda só aqui.
@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [
    { provide: MarketDataProvider, useClass: BcbMarketDataProvider },
    {
      provide: SyncIndicatorsUseCase,
      inject: [IndicatorValuesRepository, MarketDataProvider],
      useFactory: (
        indicators: IndicatorValuesRepository,
        provider: MarketDataProvider
      ) => new SyncIndicatorsUseCase(indicators, provider),
    },
    IndicatorsSyncJob,
  ],
})
export class JobsModule {}
