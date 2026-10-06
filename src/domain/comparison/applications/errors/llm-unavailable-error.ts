import { UseCaseError } from '@/core/errors/use-case-error'

export class LlmUnavailableError extends Error implements UseCaseError {
  constructor() {
    super('The language model is unavailable. Try again later.')
  }
}
