import { Position } from '../../entities/position'

export abstract class PositionsRepository {
  abstract findById(id: string): Promise<Position | null>
  abstract create(position: Position): Promise<void>
  abstract save(position: Position): Promise<void>
}
