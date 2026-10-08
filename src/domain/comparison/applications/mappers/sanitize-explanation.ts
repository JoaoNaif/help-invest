import { ComparisonExplanation } from '../dtos/comparison-explanation'

/** Itens por lista de prós/contras que a tela comporta. */
export const MAX_POINTS_PER_OPTION = 3

/**
 * Confere a explicação do LLM contra o que existe de verdade: o LLM pode
 * devolver um id inventado ou repetir opção. Id desconhecido é descartado,
 * a indicação some junto com o motivo, e listas vão aparadas. Sem resumo
 * utilizável a explicação inteira é recusada (`null`).
 */
export function sanitizeExplanation(
  explanation: ComparisonExplanation,
  validOptionIds: string[]
): ComparisonExplanation | null {
  const valid = new Set(validOptionIds)
  const summary = explanation.summary.trim()

  if (!summary) return null

  const bestOptionId =
    explanation.bestOptionId && valid.has(explanation.bestOptionId)
      ? explanation.bestOptionId
      : null
  const bestReason = explanation.bestReason?.trim() || null

  const seen = new Set<string>()
  const options = explanation.options.flatMap((option) => {
    if (!valid.has(option.optionId) || seen.has(option.optionId)) return []

    seen.add(option.optionId)

    return [
      {
        optionId: option.optionId,
        pros: clean(option.pros),
        cons: clean(option.cons),
      },
    ]
  })

  return {
    summary,
    bestOptionId,
    bestReason: bestOptionId ? bestReason : null,
    options,
  }
}

function clean(points: string[]) {
  return points
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, MAX_POINTS_PER_OPTION)
}
