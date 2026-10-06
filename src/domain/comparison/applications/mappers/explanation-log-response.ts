/**
 * Formato do `LlmLog.response` das chamadas de EXPLANATION.
 * O texto fica num campo que o domínio controla (`explanation`) e a resposta
 * bruta da API vai junto (`raw`) para auditoria — assim o domínio não precisa
 * conhecer o formato do provedor do LLM para mostrar a explicação de novo.
 */
export interface ExplanationLogResponse {
  explanation: string | null
  raw: unknown
}

export function toExplanationLogResponse(
  explanation: string | null,
  raw: unknown
): ExplanationLogResponse {
  return { explanation, raw }
}

/** Texto da explicação, ou `null` se o log não tiver uma válida. */
export function readExplanation(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) return null

  const { explanation } = response as Partial<ExplanationLogResponse>

  return typeof explanation === 'string' && explanation.trim()
    ? explanation
    : null
}
