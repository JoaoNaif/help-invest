import { AssetClass } from '../../entities/enums/asset-class'
import { PortfolioExplanation } from '../dtos/portfolio-explanation'

/** Itens por lista que a tela comporta. */
export const MAX_ITEMS_PER_LIST = 3

/**
 * Confere a explicação do LLM contra o que existe de verdade: classe que ele
 * inventou ou repetiu é descartada e as listas vão aparadas. Sem resumo
 * utilizável a explicação inteira é recusada (`null`).
 */
export function sanitizePortfolioExplanation(
  explanation: PortfolioExplanation
): PortfolioExplanation | null {
  const summary = explanation.summary.trim()

  if (!summary) return null

  const validClasses = new Set<string>(Object.values(AssetClass))
  const seen = new Set<string>()

  const highlights = explanation.highlights
    .flatMap((highlight) => {
      const text = highlight.text.trim()

      if (
        !text ||
        !validClasses.has(highlight.assetClass) ||
        seen.has(highlight.assetClass)
      ) {
        return []
      }

      seen.add(highlight.assetClass)

      return [{ assetClass: highlight.assetClass, text }]
    })
    .slice(0, MAX_ITEMS_PER_LIST)

  const attentionPoints = explanation.attentionPoints
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS_PER_LIST)

  return { summary, highlights, attentionPoints }
}
