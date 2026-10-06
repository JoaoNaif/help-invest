import { Either, left, right } from '@/core/either'
import { ComparisonExplanationInput } from '@/domain/comparison/applications/dtos/comparison-explanation-input'
import { ComparisonOptionInput } from '@/domain/comparison/applications/dtos/comparison-option-input'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import {
  ExplainComparisonResult,
  ExtractionSource,
  ExtractOptionsResult,
  LlmGateway,
} from '@/domain/comparison/applications/gateways/llm-gateway'

/**
 * Resposta fixa. `extractedOptions`/`explanation = null` simula resposta
 * inválida; `unavailable = true` simula a API fora do ar.
 */
export class FakeLlmGateway implements LlmGateway {
  public extractedOptions: ComparisonOptionInput[] | null = []
  public explanation: string | null = 'A opção 1 rende mais líquido.'
  public unavailable = false
  public calls: ExtractionSource[] = []
  public explainCalls: ComparisonExplanationInput[] = []

  async extractOptions(
    source: ExtractionSource
  ): Promise<Either<LlmUnavailableError, ExtractOptionsResult>> {
    this.calls.push(source)

    if (this.unavailable) {
      return left(new LlmUnavailableError())
    }

    return right({
      call: {
        model: 'fake-model',
        prompt:
          source.type === 'text'
            ? `extract: ${source.text}`
            : 'extract: [image]',
        rawResponse: { options: this.extractedOptions ?? 'garbage' },
        inputTokens: 100,
        outputTokens: 50,
      },
      options: this.extractedOptions,
    })
  }

  async explainComparison(
    input: ComparisonExplanationInput
  ): Promise<Either<LlmUnavailableError, ExplainComparisonResult>> {
    this.explainCalls.push(input)

    if (this.unavailable) {
      return left(new LlmUnavailableError())
    }

    return right({
      call: {
        model: 'fake-model',
        prompt: `explain: ${JSON.stringify(input)}`,
        rawResponse: { text: this.explanation ?? '' },
        inputTokens: 300,
        outputTokens: 200,
      },
      explanation: this.explanation,
    })
  }
}
