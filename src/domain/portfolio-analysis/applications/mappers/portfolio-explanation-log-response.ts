import { AssetClass } from '../../entities/enums/asset-class'
import { PortfolioExplanation } from '../dtos/portfolio-explanation'

/**
 * Formato do `LlmLog.response` das chamadas de PORTFOLIO_EXPLANATION: a
 * explicação num campo que o domínio controla e a resposta bruta junto, para
 * auditoria (mesmo desenho do comparador).
 */
export interface PortfolioExplanationLogResponse {
  explanation: PortfolioExplanation | null
  raw: unknown
}

export function toPortfolioExplanationLogResponse(
  explanation: PortfolioExplanation | null,
  raw: unknown
): PortfolioExplanationLogResponse {
  return { explanation, raw }
}

/** Explicação gravada no log, ou `null` se o log não tiver uma válida. */
export function readPortfolioExplanation(
  response: unknown
): PortfolioExplanation | null {
  if (typeof response !== 'object' || response === null) return null

  const { explanation } = response as Partial<PortfolioExplanationLogResponse>

  return isPortfolioExplanation(explanation) ? explanation : null
}

function isPortfolioExplanation(value: unknown): value is PortfolioExplanation {
  if (typeof value !== 'object' || value === null) return false

  const { summary, highlights, attentionPoints } =
    value as Partial<PortfolioExplanation>

  const classes = new Set<string>(Object.values(AssetClass))

  return (
    typeof summary === 'string' &&
    summary.trim() !== '' &&
    Array.isArray(highlights) &&
    highlights.every(
      (highlight) =>
        typeof highlight === 'object' &&
        highlight !== null &&
        classes.has(highlight.assetClass) &&
        typeof highlight.text === 'string'
    ) &&
    Array.isArray(attentionPoints) &&
    attentionPoints.every((point) => typeof point === 'string')
  )
}
