import { ComparisonExplanation } from '../dtos/comparison-explanation'

/**
 * Formato do `LlmLog.response` das chamadas de EXPLANATION.
 * A explicação fica num campo que o domínio controla (`explanation`) e a
 * resposta bruta da API vai junto (`raw`) para auditoria — assim o domínio não
 * precisa conhecer o formato do provedor do LLM para mostrar a explicação de novo.
 */
export interface ExplanationLogResponse {
  explanation: ComparisonExplanation | null
  raw: unknown
}

export function toExplanationLogResponse(
  explanation: ComparisonExplanation | null,
  raw: unknown
): ExplanationLogResponse {
  return { explanation, raw }
}

/**
 * Explicação gravada no log, ou `null` se o log não tiver uma válida.
 * Logs antigos, em texto corrido, não valem: ficam só como auditoria.
 */
export function readExplanation(
  response: unknown
): ComparisonExplanation | null {
  if (typeof response !== 'object' || response === null) return null

  const { explanation } = response as Partial<ExplanationLogResponse>

  return isComparisonExplanation(explanation) ? explanation : null
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isComparisonExplanation(value: unknown): value is ComparisonExplanation {
  if (typeof value !== 'object' || value === null) return false

  const { summary, bestOptionId, bestReason, options } =
    value as Partial<ComparisonExplanation>

  return (
    typeof summary === 'string' &&
    summary.trim() !== '' &&
    (bestOptionId === null || typeof bestOptionId === 'string') &&
    (bestReason === null || typeof bestReason === 'string') &&
    Array.isArray(options) &&
    options.every(
      (option) =>
        typeof option === 'object' &&
        option !== null &&
        typeof option.optionId === 'string' &&
        isStringList(option.pros) &&
        isStringList(option.cons)
    )
  )
}
