import { Position } from '../../entities/position'

export abstract class PositionsRepository {
  abstract findById(id: string): Promise<Position | null>
  /** Todas as posições do usuário, mais recentes primeiro. */
  abstract findManyByUserId(userId: string): Promise<Position[]>
  abstract create(position: Position): Promise<void>
  abstract save(position: Position): Promise<void>
  abstract delete(position: Position): Promise<void>
}
