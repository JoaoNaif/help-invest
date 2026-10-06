import { Injectable } from '@nestjs/common'
import { Either, left } from '@/core/either'
import { LlmUnavailableError } from '@/domain/comparison/applications/errors/llm-unavailable-error'
import {
  ExplainComparisonResult,
  ExtractOptionsResult,
  LlmGateway,
} from '@/domain/comparison/applications/gateways/llm-gateway'

/**
 * Placeholder até existir o adapter da Anthropic: toda chamada responde
 * `LlmUnavailableError` (HTTP 503). A comparação com opções digitadas
 * (`type: 'manual'`) não passa pelo LLM e funciona normalmente.
 * Trocar por o adapter real em `HttpModule` quando ele for feito.
 */
@Injectable()
export class UnavailableLlmGateway implements LlmGateway {
  async extractOptions(): Promise<
    Either<LlmUnavailableError, ExtractOptionsResult>
  > {
    return left(new LlmUnavailableError())
  }

  async explainComparison(): Promise<
    Either<LlmUnavailableError, ExplainComparisonResult>
  > {
    return left(new LlmUnavailableError())
  }
}
