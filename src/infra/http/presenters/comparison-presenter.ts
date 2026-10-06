import { Comparison } from '@/domain/comparison/entities/comparison'
import { ComparisonOption } from '@/domain/comparison/entities/comparison-option'
import { formatDateOnly } from '../schemas/common'

export class ComparisonPresenter {
  static toHTTP(comparison: Comparison) {
    return {
      id: comparison.id.toString(),
      amount: comparison.amount.toString(),
      horizonMonths: comparison.horizonMonths,
      status: comparison.status,
      assumptions: comparison.assumptions,
      chosenOptionId: comparison.chosenOptionId?.toString() ?? null,
      createdAt: comparison.createdAt,
      updatedAt: comparison.updatedAt,
    }
  }

  static optionToHTTP(option: ComparisonOption) {
    return {
      id: option.id.toString(),
      assetType: option.assetType,
      issuerName: option.issuerName,
      issuerCnpj: option.issuerCnpj,
      indexer: option.indexer,
      rate: option.rate.toString(),
      maturityAt: formatDateOnly(option.maturityAt),
      liquidity: option.liquidity,
      graceDays: option.graceDays,
      minAmount: option.minAmount?.toString() ?? null,
      netAnnualRate: option.netAnnualRate?.toString() ?? null,
      alerts: option.alerts,
      rawInput: option.rawInput,
      source: option.source,
      createdAt: option.createdAt,
    }
  }
}
