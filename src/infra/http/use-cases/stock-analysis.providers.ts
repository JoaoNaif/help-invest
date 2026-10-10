import { Provider } from '@nestjs/common'
import { InvestorProfilesRepository } from '@/domain/portfolio/applications/repositories/investor-profiles-repository'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { StockDataProvider } from '@/domain/stock-analysis/applications/gateways/stock-data-provider'
import { StockAnalysesRepository } from '@/domain/stock-analysis/applications/repositories/stock-analyses-repository'
import { CreateStockAnalysisUseCase } from '@/domain/stock-analysis/applications/use-cases/create-stock-analysis'
import { GetStockAnalysisUseCase } from '@/domain/stock-analysis/applications/use-cases/get-stock-analysis'
import { ListStockAnalysesUseCase } from '@/domain/stock-analysis/applications/use-cases/list-stock-analyses'

export const stockAnalysisUseCases: Provider[] = [
  {
    provide: CreateStockAnalysisUseCase,
    inject: [
      StockDataProvider,
      StockAnalysesRepository,
      PositionsRepository,
      InvestorProfilesRepository,
    ],
    useFactory: (
      stockData: StockDataProvider,
      analyses: StockAnalysesRepository,
      positions: PositionsRepository,
      profiles: InvestorProfilesRepository
    ) =>
      new CreateStockAnalysisUseCase(stockData, analyses, positions, profiles),
  },
  {
    provide: GetStockAnalysisUseCase,
    inject: [StockAnalysesRepository],
    useFactory: (analyses: StockAnalysesRepository) =>
      new GetStockAnalysisUseCase(analyses),
  },
  {
    provide: ListStockAnalysesUseCase,
    inject: [StockAnalysesRepository],
    useFactory: (analyses: StockAnalysesRepository) =>
      new ListStockAnalysesUseCase(analyses),
  },
]
