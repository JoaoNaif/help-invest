import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import {
  StockAnalysis,
  StockAnalysisProps,
} from '@/domain/stock-analysis/entities/stock-analysis'

export function makeStockAnalysis(
  override: Partial<StockAnalysisProps> = {},
  id?: UniqueEntityId
) {
  return StockAnalysis.create(
    {
      userId: new UniqueEntityId(),
      tickers: ['BBAS3'],
      result: { items: [], alerts: [] },
      assumptions: { bazinRequiredYieldPercent: '6' },
      ...override,
    },
    id
  )
}
