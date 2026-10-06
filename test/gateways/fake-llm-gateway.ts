import { Either, left, right } from '@/core/either'
import { ComparisonOptionInput } from '@/domain/comparison/applications/dtos/comparison-option-input'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import {
  ExtractionSource,
  ExtractOptionsResult,
  LlmGateway,
} from '@/domain/comparison/applications/gateways/llm-gateway'

/**
 * Resposta fixa. `extractedOptions = null` simula resposta inválida;
 * `unavailable = true` simula a API fora do ar.
 */
export class FakeLlmGateway implements LlmGateway {
  public extractedOptions: ComparisonOptionInput[] | null = []
  public unavailable = false
  public calls: ExtractionSource[] = []

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
}
