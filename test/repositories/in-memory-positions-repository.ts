import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { Position } from '@/domain/portfolio/entities/position'

export class InMemoryPositionsRepository implements PositionsRepository {
  public items: Position[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id.toString() === id) ?? null
  }

  async create(position: Position) {
    this.items.push(position)
  }

  async save(position: Position) {
    const index = this.items.findIndex((item) => item.id.equals(position.id))

    this.items[index] = position
  }

  async delete(position: Position) {
    this.items = this.items.filter((item) => !item.id.equals(position.id))
  }
}
