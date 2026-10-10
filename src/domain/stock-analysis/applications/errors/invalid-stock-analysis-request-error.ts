import { UseCaseError } from '@/core/errors/use-case-error'

export class InvalidStockAnalysisRequestError
  extends Error
  implements UseCaseError
{
  constructor(reason: string) {
    super(`Invalid stock analysis request: ${reason}`)
  }
}
