import { Provider } from '@nestjs/common'
import { IndicatorValuesRepository } from '@/domain/market-data/applications/repositories/indicator-values-repository'
import { MarketIndexProvider } from '@/domain/market-overview/applications/gateways/market-index-provider'
import { GetMarketOverviewUseCase } from '@/domain/market-overview/applications/use-cases/get-market-overview'

export const marketOverviewUseCases: Provider[] = [
  {
    provide: GetMarketOverviewUseCase,
    inject: [IndicatorValuesRepository, MarketIndexProvider],
    useFactory: (
      indicators: IndicatorValuesRepository,
      indices: MarketIndexProvider
    ) => new GetMarketOverviewUseCase(indicators, indices),
  },
]
