import { Injectable } from '@nestjs/common'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { SessionsRepository } from '@/domain/accounts/applications/repositories/sessions-repository'
import { Session } from '@/domain/accounts/entities/session'
import { PrismaSessionMapper } from '../mappers/prisma-session-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    })

    return session ? PrismaSessionMapper.toDomain(session) : null
  }

  async create(session: Session): Promise<void> {
    await this.prisma.session.create({
      data: PrismaSessionMapper.toPrisma(session),
    })
  }

  async save(session: Session): Promise<void> {
    const data = PrismaSessionMapper.toPrisma(session)

    await this.prisma.session.update({ where: { id: data.id }, data })
  }

  async revokeAllByUserId(userId: UniqueEntityId, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId: userId.toString(), revokedAt: null },
      data: { revokedAt: now },
    })
  }
}
