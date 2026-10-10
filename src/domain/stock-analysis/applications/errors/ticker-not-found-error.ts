import { UseCaseError } from '@/core/errors/use-case-error'

export class TickerNotFoundError extends Error implements UseCaseError {
  constructor(ticker: string) {
    super(`Ticker "${ticker}" was not found.`)
  }
}
