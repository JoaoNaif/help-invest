import { Either, left, right } from '@/core/either'
import { NotAllowedError } from '@/core/errors/err/not-allowed-error'
import { ResourceNotFoundError } from '@/core/errors/err/resource-not-found'
import { PositionsRepository } from '../repositories/positions-repository'

interface DeletePositionUseCaseRequest {
  userId: string
  positionId: string
}

type DeletePositionUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  null
>

/** UC-10 — ver docs/08-casos-de-uso.md#uc-10--deleteposition */
export class DeletePositionUseCase {
  constructor(private positionsRepository: PositionsRepository) {}

  async execute({
    userId,
    positionId,
  }: DeletePositionUseCaseRequest): Promise<DeletePositionUseCaseResponse> {
    const position = await this.positionsRepository.findById(positionId)

    if (!position) {
      return left(new ResourceNotFoundError('Position'))
    }

    if (position.userId.toString() !== userId) {
      return left(new NotAllowedError())
    }

    await this.positionsRepository.delete(position)

    return right(null)
  }
}
