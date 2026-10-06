import { Either, right } from '@/core/either'
import { Position } from '../../entities/position'
import { PositionsRepository } from '../repositories/positions-repository'

interface ListPositionsUseCaseRequest {
  userId: string
}

type ListPositionsUseCaseResponse = Either<never, { positions: Position[] }>

/**
 * UC-11 — ver docs/08-casos-de-uso.md#uc-11--listpositions
 * Sem paginação: uma carteira pessoal tem poucas dezenas de posições.
 */
export class ListPositionsUseCase {
  constructor(private positionsRepository: PositionsRepository) {}

  async execute({
    userId,
  }: ListPositionsUseCaseRequest): Promise<ListPositionsUseCaseResponse> {
    const positions = await this.positionsRepository.findManyByUserId(userId)

    return right({ positions })
  }
}
