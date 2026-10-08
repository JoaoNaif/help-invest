import { ComparisonSummary } from '@/domain/comparison/applications/use-cases/list-comparisons'
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
      goal: comparison.goal,
      createdAt: comparison.createdAt,
      updatedAt: comparison.updatedAt,
    }
  }

  /** Linha do histórico: a comparação e o resumo das opções. */
  static summaryToHTTP({ comparison, optionsCount, topOption }: ComparisonSummary) {
    return {
      ...ComparisonPresenter.toHTTP(comparison),
      optionsCount,
      topOption: topOption
        ? {
            issuerName: topOption.issuerName,
            assetType: topOption.assetType,
            netAnnualRate: topOption.netAnnualRate?.toString() ?? null,
          }
        : null,
    }
  }

  /** Só os dados de entrada: serve para preencher uma nova comparação. */
  static recentOptionToHTTP(option: ComparisonOption) {
    return {
      assetType: option.assetType,
      issuerName: option.issuerName,
      issuerCnpj: option.issuerCnpj,
      indexer: option.indexer,
      rate: option.rate.toString(),
      maturityAt: formatDateOnly(option.maturityAt),
      liquidity: option.liquidity,
      graceDays: option.graceDays,
      minAmount: option.minAmount?.toString() ?? null,
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
