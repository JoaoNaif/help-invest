import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { LlmPurpose } from './enums/llm-purpose'

export interface LlmLogProps {
  userId: UniqueEntityId
  purpose: LlmPurpose
  /** Ex.: "claude-sonnet-5-5". */
  model: string
  prompt: string
  /** Saída bruta do LLM, mesmo quando falha na validação do Zod. */
  response: unknown
  inputTokens: number
  outputTokens: number
  comparisonId: UniqueEntityId | null
  createdAt: Date
}

/** Auditoria de uma chamada ao LLM. Somente inserção: não tem setters. */
export class LlmLog extends Entity<LlmLogProps> {
  get userId() {
    return this.props.userId
  }

  get purpose() {
    return this.props.purpose
  }

  get model() {
    return this.props.model
  }

  get prompt() {
    return this.props.prompt
  }

  get response() {
    return this.props.response
  }

  get inputTokens() {
    return this.props.inputTokens
  }

  get outputTokens() {
    return this.props.outputTokens
  }

  get comparisonId() {
    return this.props.comparisonId
  }

  get createdAt() {
    return this.props.createdAt
  }

  static create(
    props: Optional<LlmLogProps, 'comparisonId' | 'createdAt'>,
    id?: UniqueEntityId
  ) {
    return new LlmLog(
      {
        ...props,
        comparisonId: props.comparisonId ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    )
  }
}
