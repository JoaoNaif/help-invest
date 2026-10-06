import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { Position } from '@/domain/portfolio/entities/position'

export class InMemoryPositionsRepository implements PositionsRepository {
  public items: Position[] = []

  async create(position: Position) {
    this.items.push(position)
  }
}
