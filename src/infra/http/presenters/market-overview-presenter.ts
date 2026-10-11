import { MarketOverview } from '@/domain/market-overview/applications/dtos/market-overview'

export class MarketOverviewPresenter {
  static toHTTP(overview: MarketOverview) {
    // Já vem pronto do motor: strings com 2 casas, datas ISO, motivos e alertas.
    return overview
  }
}
