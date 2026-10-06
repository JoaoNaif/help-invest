import { Position } from '../../entities/position'

export abstract class PositionsRepository {
  abstract create(position: Position): Promise<void>
}
