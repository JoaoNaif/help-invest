import { Either } from '@/core/either'
import { ComparisonExplanation } from '../dtos/comparison-explanation'
import { ComparisonExplanationInput } from '../dtos/comparison-explanation-input'
import { ComparisonOptionInput } from '../dtos/comparison-option-input'
import { LlmUnavailableError } from '../errors/llm-unavailable-error'

export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp'

export type ExtractionSource =
  | { type: 'text'; text: string }
  /** A imagem só é repassada ao LLM — nunca armazenada. */
  | { type: 'image'; base64: string; mediaType: ImageMediaType }

/** Dados de uma chamada ao LLM, para gravar no LlmLog. */
export interface LlmCall {
  /** Ex.: "claude-sonnet-5-5". */
  model: string
  /** Prompt enviado, sem a imagem. */
  prompt: string
  /** Resposta bruta, mesmo quando inválida. */
  rawResponse: unknown
  inputTokens: number
  outputTokens: number
}

export interface ExtractOptionsResult {
  call: LlmCall
  /** `null` = a resposta não passou na validação (Zod, no adapter). */
  options: ComparisonOptionInput[] | null
}

export interface ExplainComparisonResult {
  call: LlmCall
  /** `null` = resposta vazia ou inválida. */
  explanation: ComparisonExplanation | null
}

/**
 * Port do LLM (adapter real: API da Anthropic). Só extrai e explica —
 * nunca calcula taxa, imposto ou alerta.
 * Falha de rede/API vira `left(LlmUnavailableError)`, nunca `throw`.
 */
export abstract class LlmGateway {
  abstract extractOptions(
    source: ExtractionSource
  ): Promise<Either<LlmUnavailableError, ExtractOptionsResult>>

  abstract explainComparison(
    input: ComparisonExplanationInput
  ): Promise<Either<LlmUnavailableError, ExplainComparisonResult>>
}
