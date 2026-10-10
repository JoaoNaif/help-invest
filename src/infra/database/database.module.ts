import { Module } from '@nestjs/common'
import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { UsersRepository } from '@/domain/accounts/applications/repositories/users-repository'
import { ComparisonsRepository } from '@/domain/comparison/applications/repositories/comparisons-repository'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { StockAnalysesRepository } from '@/domain/stock-analysis/applications/repositories/stock-analyses-repository'
import { PrismaService } from './prisma/prisma.service'
import { PrismaComparisonsRepository } from './prisma/repositories/prisma-comparisons-repository'
import { PrismaIndicatorValuesRepository } from './prisma/repositories/prisma-indicator-values-repository'
import { PrismaInvestorProfilesRepository } from './prisma/repositories/prisma-investor-profiles-repository'
import { PrismaLlmLogsRepository } from './prisma/repositories/prisma-llm-logs-repository'
import { PrismaPositionsRepository } from './prisma/repositories/prisma-positions-repository'
import { PrismaSessionsRepository } from './prisma/repositories/prisma-sessions-repository'
import { PrismaStockAnalysesRepository } from './prisma/repositories/prisma-stock-analyses-repository'
import { PrismaUsersRepository } from './prisma/repositories/prisma-users-repository'

// Cada repositório (port do domain → adapter Prisma) entra aqui em `providers`
// e `exports`, no formato { provide: XRepository, useClass: PrismaXRepository }.
@Module({
  providers: [
    PrismaService,
    { provide: UsersRepository, useClass: PrismaUsersRepository },
    { provide: SessionsRepository, useClass: PrismaSessionsRepository },
    {
      provide: InvestorProfilesRepository,
      useClass: PrismaInvestorProfilesRepository,
    },
    { provide: PositionsRepository, useClass: PrismaPositionsRepository },
    {
      provide: IndicatorValuesRepository,
      useClass: PrismaIndicatorValuesRepository,
    },
    { provide: ComparisonsRepository, useClass: PrismaComparisonsRepository },
    { provide: LlmLogsRepository, useClass: PrismaLlmLogsRepository },
    {
      provide: StockAnalysesRepository,
      useClass: PrismaStockAnalysesRepository,
    },
  ],
  exports: [
    PrismaService,
    UsersRepository,
    SessionsRepository,
    InvestorProfilesRepository,
    PositionsRepository,
    IndicatorValuesRepository,
    ComparisonsRepository,
    LlmLogsRepository,
    StockAnalysesRepository,
  ],
})
export class DatabaseModule {}
