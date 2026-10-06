import { UseCaseError } from '@/core/errors/use-case-error'

export class ExplanationFailedError extends Error implements UseCaseError {
  constructor() {
    super('Could not generate the explanation. Try again.')
  }
}
