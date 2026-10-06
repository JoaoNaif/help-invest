import { Injectable } from '@nestjs/common'
import { PositionsRepository } from '@/domain/portfolio/applications/repositories/positions-repository'
import { Position } from '@/domain/portfolio/entities/position'
import { PrismaPositionMapper } from '../mappers/prisma-position-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaPositionsRepository implements PositionsRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Position | null> {
    const position = await this.prisma.position.findUnique({ where: { id } })

    return position ? PrismaPositionMapper.toDomain(position) : null
  }

  async findManyByUserId(userId: string): Promise<Position[]> {
    const positions = await this.prisma.position.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return positions.map(PrismaPositionMapper.toDomain)
  }

  async create(position: Position): Promise<void> {
    await this.prisma.position.create({
      data: PrismaPositionMapper.toPrisma(position),
    })
  }

  async save(position: Position): Promise<void> {
    const data = PrismaPositionMapper.toPrisma(position)

    await this.prisma.position.update({ where: { id: data.id }, data })
  }

  async delete(position: Position): Promise<void> {
    await this.prisma.position.delete({ where: { id: position.id.toString() } })
  }
}
