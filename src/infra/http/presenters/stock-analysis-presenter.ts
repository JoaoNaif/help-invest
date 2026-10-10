import { StockAnalysis } from '@/domain/stock-analysis/entities/stock-analysis'

export class StockAnalysisPresenter {
  static toHTTP(analysis: StockAnalysis) {
    return {
      id: analysis.id.toString(),
      tickers: analysis.tickers,
      // Já vem pronto do motor: strings, datas ISO e alertas.
      result: analysis.result,
      assumptions: analysis.assumptions,
      createdAt: analysis.createdAt,
    }
  }
}
