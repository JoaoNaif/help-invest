import { UseCaseError } from '@/core/errors/use-case-error'

export class ExtractionFailedError extends Error implements UseCaseError {
  constructor() {
    super('Could not read the options. Try again or type them manually.')
  }
}
