import { UseCaseError } from '@/core/errors/use-case-error'
import { Indicator } from '@/domain/market-data/entities/enums/indicator'

export class IndicatorUnavailableError extends Error implements UseCaseError {
  constructor(indicator: Indicator) {
    super(
      `No recent ${indicator} value to evaluate the comparison. Sync the indicators and try again.`
    )
  }
}
