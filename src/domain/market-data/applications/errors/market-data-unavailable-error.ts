import { UseCaseError } from '@/core/errors/use-case-error'

export class MarketDataUnavailableError extends Error implements UseCaseError {
  constructor(source: string) {
    super(`Market data source "${source}" is unavailable.`)
  }
}
