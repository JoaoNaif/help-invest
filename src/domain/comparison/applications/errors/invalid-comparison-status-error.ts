import { UseCaseError } from '@/core/errors/use-case-error'
import { ComparisonStatus } from '../../entities/enums/comparison-status'

export class InvalidComparisonStatusError
  extends Error
  implements UseCaseError
{
  constructor(current: ComparisonStatus, expected: ComparisonStatus) {
    super(`Comparison is ${current}; this action requires ${expected}.`)
  }
}
