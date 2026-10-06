import { UseCaseError } from '@/core/errors/use-case-error'

export class InvalidSessionError extends Error implements UseCaseError {
  constructor() {
    super('Session is not valid.')
  }
}
