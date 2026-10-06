import { UseCaseError } from '@/core/errors/use-case-error'

export class NoOptionsFoundError extends Error implements UseCaseError {
  constructor() {
    super('No investment options were found to compare.')
  }
}
