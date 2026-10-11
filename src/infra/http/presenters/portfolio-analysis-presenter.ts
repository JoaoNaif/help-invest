import { PortfolioExplanation } from '@/domain/portfolio-analysis/applications/dtos/portfolio-explanation'
import { PortfolioAnalysis } from '@/domain/portfolio-analysis/entities/portfolio-analysis'

export class PortfolioAnalysisPresenter {
  /**
   * `explanation` só aparece quando quem chama a conhece (GET :id e POST):
   * a listagem não carrega os logs do LLM, então omite o campo em vez de
   * mentir com `null`.
   */
  static toHTTP(
    analysis: PortfolioAnalysis,
    explanation?: PortfolioExplanation | null
  ) {
    return {
      id: analysis.id.toString(),
      strategy: analysis.strategy,
      createdAt: analysis.createdAt,
      // Já vem pronto do motor: strings com 2 casas, datas ISO e alertas.
      result: analysis.result,
      assumptions: analysis.assumptions,
      ...(explanation !== undefined && { explanation }),
    }
  }
}
